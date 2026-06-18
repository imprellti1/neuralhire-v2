import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { logger } from '../../core/logger.js';
import { listClientes } from '../clientes/clientes.repository.js';
import { listAuditLogs } from '../audit-logs/audit-logs.repository.js';
import { enrichClienteByCnpj, geolocalizarCliente, getNextClienteForEnrichment, getNextClienteForGeolocation } from '../clientes/clientes.repository.js';
import { listClientePedidos } from '../clientes/clientes.repository.js';
import { gerarAlertasCliente } from '../clientes/clientes.alerts.service.js';
import { recalcularSegmentacaoCliente } from '../clientes/clientes.segmentacao.service.js';
import { registrarEventoTimeline } from '../clientes/clientes.timeline.service.js';
import { calcularScoreComercialCliente } from '../clientes/clientes.repository.js';
import { createObservationIfNotOpen, listObservations } from '../ai-director-observations/ai-director-observations.repository.js';
import { listExecutiveMemories, upsertExecutiveMemory } from '../ai-director/ai-director.repository.js';
import { acquireSystemJobLock, getSystemJobByLockKey, listDueSystemJobs, listSystemJobRuns, listSystemJobs, recordSystemJobRun, releaseSystemJobLock, updateSystemJobSchedule, upsertSystemJob } from './jobs.repository.js';
import { resolveJobNotificationRecipient, sendJobNotificationEmail } from '../notifications/notifications.email.service.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { listProdutos } from '../produtos/produtos.repository.js';
import { listPromocoes } from '../promocoes/promocoes.repository.js';
import { listBatches } from '../legacy-import/legacy-import-staging.repository.js';

function isoNow() {
  return new Date().toISOString();
}

export function nextDaily0300(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function chunkArray(items = [], size = 25) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function nextInMinutes(now = new Date(), minutes = 30) {
  return new Date(now.getTime() + Math.max(1, Number(minutes) || 30) * 60000).toISOString();
}

function nextDaily0500(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(5, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function canonicalJobLockKey(nome) {
  return ({
    radar_comercial_diario: 'jobs:radar_comercial_diario',
    clientes_enriquecimento_automatico: 'clientes:enriquecimento:automatico',
    clientes_geolocalizacao_automatico: 'clientes:geolocalizacao:automatico',
    notificacoes_resumo_semanal: 'notificacoes:resumo-semanal',
    gerente_comercial_observacao: 'gerente_comercial_observacao',
    gerente_produtos_observacao: 'gerente_produtos_observacao',
    gerente_auditoria_observacao: 'gerente_auditoria_observacao',
    gerente_administrativo_observacao: 'gerente_administrativo_observacao',
    diretor_reuniao_executiva: 'diretor_reuniao_executiva'
  })[nome] || nome;
}

async function resolveGlobalSystemJob(nome) {
  return getSystemJobByLockKey(canonicalJobLockKey(nome)).catch(() => null);
}

function logJobError(stage, error, details = {}) {
  console.error('[jobs.scheduler] job_error', {
    stage,
    message: error?.message || null,
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null,
    requestId: details.requestId || null,
    account_id: details.accountId || null,
    lockKey: details.lockKey || null
  });
}

const JOB_HANDLERS = {
  radar_comercial_diario: runRadarComercialJob,
  clientes_enriquecimento_automatico: runClientesEnriquecimentoJob,
  clientes_geolocalizacao_automatico: runClientesGeolocalizacaoJob,
  notificacoes_resumo_semanal: runNotificacoesResumoSemanalJob,
  gerente_comercial_observacao: runGerenteComercialObservacaoJob,
  gerente_produtos_observacao: runGerenteProdutosObservacaoJob,
  gerente_auditoria_observacao: runGerenteAuditoriaObservacaoJob,
  gerente_administrativo_observacao: runGerenteAdministrativoObservacaoJob,
  diretor_reuniao_executiva: runDiretorReuniaoExecutivaJob
};

const TENANT_AWARE_JOB_NAMES = new Set(['clientes_enriquecimento_automatico', 'clientes_geolocalizacao_automatico', 'gerente_comercial_observacao', 'gerente_produtos_observacao', 'gerente_auditoria_observacao', 'gerente_administrativo_observacao', 'diretor_reuniao_executiva']);

let schedulerTimer = null;
let schedulerRunning = false;

function normalizeSituacaoCadastral(value) {
  return String(value || '').trim().toUpperCase();
}

function isSituacaoAtiva(value) {
  return normalizeSituacaoCadastral(value) === 'ATIVA';
}

function formatJobTextSummary(summary) {
  return [
    `Clientes enriquecidos: ${summary.clientes_enriquecidos}`,
    `Clientes geolocalizados: ${summary.clientes_geolocalizados}`,
    `Erros de enriquecimento: ${summary.erros_enriquecimento}`,
    `Erros de geolocalização: ${summary.erros_geolocalizacao}`,
    `Clientes com situação cadastral diferente de ATIVA: ${summary.clientes_situacao_irregular}`,
    `Fila restante de enriquecimento: ${summary.fila_enriquecimento_restante}`,
    `Fila restante de geolocalização: ${summary.fila_geolocalizacao_restante}`
  ].join('\n');
}

function toDateOrNull(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function purchaseDateFromPedido(pedido = {}) {
  return toDateOrNull(pedido.data_faturamento) || toDateOrNull(pedido.data_emissao) || toDateOrNull(pedido.created_at) || toDateOrNull(pedido.createdAt);
}

function sumPedidosInRange(pedidos = [], fromDate, toDate) {
  return (Array.isArray(pedidos) ? pedidos : [])
    .map((pedido) => ({ pedido, date: purchaseDateFromPedido(pedido) }))
    .filter((item) => item.date && item.date >= fromDate && item.date < toDate)
    .reduce((sum, item) => sum + Number(item.pedido?.total || 0), 0);
}

function computeClientSalesSignals(pedidos = [], now = new Date()) {
  const currentEnd = now;
  const currentStart = new Date(currentEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentEnd.getTime() - 60 * 24 * 60 * 60 * 1000);
  const previousEnd = currentStart;
  return {
    faturamentoAtual: sumPedidosInRange(pedidos, currentStart, currentEnd),
    faturamentoAnterior: sumPedidosInRange(pedidos, previousStart, previousEnd)
  };
}

async function createCommercialObservation(context, payload) {
  const result = await createObservationIfNotOpen(context, payload);
  return { created: Boolean(result?.created), reason: result?.reason || null, observation: result?.observation || null };
}

async function listTenantAccountIds() {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('accounts')
      .select('id')
      .eq('status', 'active');
    if (error) {
      logger.warn('jobs_scheduler_accounts_lookup_failed', { message: error?.message || String(error) });
      return [];
    }
    return [...new Set((Array.isArray(data) ? data : []).map((item) => String(item.id || '').trim()).filter(Boolean))];
  }

  const { __dumpMemoryClientes } = await import('../clientes/clientes.repository.js');
  const clientes = __dumpMemoryClientes();
  return [...new Set((Array.isArray(clientes) ? clientes : []).map((cliente) => String(cliente.account_id || '').trim()).filter(Boolean))];
}

function observationContext(managerId, origin = managerId) {
  return {
    manager_id: managerId,
    manager_name: managerId.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
    origin
  };
}

function criticalCategoryRank(category) {
  return ({ auditoria: 4, comercial: 3, administrativo: 2, produtos: 1 })[String(category || '').toLowerCase()] || 0;
}

function prioritySeverity(severity) {
  const text = String(severity || '').toLowerCase();
  if (text === 'critical' || text === 'critica' || text === 'crítica') return 4;
  if (text === 'high' || text === 'alta') return 3;
  if (text === 'medium' || text === 'media' || text === 'média') return 2;
  return 1;
}

function resolvePriorityCategory(observation) {
  return String(observation?.category || observation?.manager_id || 'geral').trim().toLowerCase();
}

function normalizeLogicalTheme(observation = {}) {
  const metadata = observation?.metadata && typeof observation.metadata === 'object' && !Array.isArray(observation.metadata) ? observation.metadata : {};
  const candidates = [
    metadata.logical_theme,
    metadata.theme,
    metadata.tema,
    observation.logical_theme,
    observation.theme,
    observation.title,
    observation.description
  ];
  const raw = candidates.map((value) => String(value || '').trim()).find(Boolean) || 'geral';
  return raw.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
}

function executivePriorityScore(observations = []) {
  const items = Array.isArray(observations) ? observations : [];
  if (!items.length) return 0;
  const strongest = items.reduce((max, item) => {
    const urgencyValue = Number(item.urgency_score ?? item.urgency ?? 0);
    const impactValue = Number(item.impact_score ?? item.impact ?? 0);
    const urgency = urgencyValue >= 80 ? 50 : urgencyValue >= 50 ? 30 : urgencyValue > 0 ? 10 : ({ critical: 50, critica: 50, 'crítica': 50, high: 30, alta: 30, medium: 10, media: 10, 'média': 10, low: 10, baixa: 10 }[String(item.urgency || item.severity || '').toLowerCase()] ?? 10);
    const impact = impactValue >= 80 ? 50 : impactValue >= 50 ? 30 : impactValue > 0 ? 10 : ({ critical: 50, critica: 50, 'crítica': 50, high: 30, alta: 30, medium: 10, media: 10, 'média': 10, low: 10, baixa: 10 }[String(item.impact || item.severity || '').toLowerCase()] ?? 10);
    return Math.max(max, urgency + impact);
  }, 0);
  const category = resolvePriorityCategory(items[0]);
  const categoryBonus = { auditoria: 30, comercial: 25, administrativo: 15, produtos: 10 }[category] || 0;
  const recentBonus = items.some((item) => new Date(item.created_at || item.updated_at || 0).getTime() >= Date.now() - 24 * 60 * 60 * 1000) ? 10 : 0;
  const entityBonus = items.some((item) => {
    const metadata = item?.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata) ? item.metadata : {};
    return Boolean(metadata.entity_critical || metadata.critical_entity || metadata.critical || metadata.entidade_critica);
  }) ? 10 : 0;
  return Math.round(strongest + Math.min(50, items.length * 5) + categoryBonus + recentBonus + entityBonus);
}

function buildExecutivePriorityTitle(category, managerId, theme, count) {
  const labels = { auditoria: 'Pendências críticas de auditoria', comercial: 'Clientes em risco comercial', administrativo: 'Pendências administrativas de cadastro', produtos: 'Pendências críticas de produtos' };
  const base = labels[String(category || '').toLowerCase()] || 'Prioridade executiva';
  const manager = String(managerId || '').trim().replace(/_/g, ' ');
  const themeLabel = String(theme || '').trim().replace(/_/g, ' ');
  const focus = manager || themeLabel || 'grupo consolidado';
  return `${base}: ${focus}${count > 1 ? ` (${count})` : ''}`.slice(0, 120);
}

function buildExecutivePriorityDescription(observations = [], windowDays = 7) {
  const total = observations.length;
  const managers = [...new Set(observations.map((item) => item.manager_name || item.manager_id).filter(Boolean))];
  return `Consolida ${total} observação(ões) na janela de ${windowDays} dia(s), envolvendo ${managers.join(', ') || 'gerentes não informados'}. Motivo: recorrência e criticidade do grupo. Recomenda-se acompanhamento executivo e resolução priorizada.`;
}

async function listTenantExecutiveAccounts() {
  const accountIds = await listTenantAccountIds();
  return accountIds;
}

async function collectExecutivePriorities(accountId, windowDays = 7) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const observations = await listObservations({ accountId }, { status: 'open', limit: 500 });
  const recent = (observations.items || []).filter((item) => String(item.created_at || '') >= since || String(item.updated_at || '') >= since);
  const grouped = new Map();
  for (const observation of recent) {
    const key = [String(accountId || ''), resolvePriorityCategory(observation), String(observation.manager_id || observation.origin || ''), normalizeLogicalTheme(observation)].join('|');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(observation);
  }
  const candidates = [...grouped.entries()].map(([key, items]) => {
    const [, category, managerId, theme] = key.split('|');
    const score = executivePriorityScore(items);
    return {
      key,
      account_id: accountId,
      tipo: 'prioridade_executiva',
      categoria: category || 'geral',
      titulo: buildExecutivePriorityTitle(category, managerId, theme, items.length),
      descricao: buildExecutivePriorityDescription(items, windowDays),
      severidade: score >= 100 ? 'critica' : score >= 70 ? 'alta' : score >= 40 ? 'media' : 'baixa',
      origem: 'diretor_reuniao_executiva',
      metadata: {
        score,
        rank: 0,
        observation_ids: items.map((item) => item.id),
        total_observations: items.length,
        managers: [...new Set(items.map((item) => item.manager_id).filter(Boolean))],
        categories: [...new Set(items.map((item) => item.category).filter(Boolean))],
        generated_by: 'diretor_reuniao_executiva',
        window_days: windowDays,
        criteria_version: 1,
        theme
      }
    };
  });
  candidates.sort((a, b) => b.metadata.score - a.metadata.score || criticalCategoryRank(b.categoria) - criticalCategoryRank(a.categoria) || b.metadata.total_observations - a.metadata.total_observations || String(a.titulo).localeCompare(String(b.titulo)));
  return candidates.slice(0, 5).map((item, index) => ({ ...item, metadata: { ...item.metadata, rank: index + 1 } }));
}

async function runObservationByTenant(job, context, accountId, analyzer) {
  const startedAt = Date.now();
  let created = 0;
  let skipped = 0;
  let analyzed = 0;
  let metadata = {};
  let fatalError = null;

  try {
    const outcome = await analyzer({ accountId, context });
    created = Number(outcome?.created || 0);
    skipped = Number(outcome?.skipped || 0);
    analyzed = Number(outcome?.analyzed || 0);
    metadata = outcome?.metadata || { created, skipped, analyzed };
  } catch (error) {
    fatalError = error;
    logJobError(`run${job.nome}`, error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
  }

  const finishedAt = isoNow();
  await recordSystemJobRun({
    job_id: job.id,
    account_id: accountId,
    nome: job.nome,
    status: fatalError ? 'error' : 'success',
    started_at: new Date(startedAt).toISOString(),
    finished_at: finishedAt,
    duration_ms: Date.now() - startedAt,
    processed_count: analyzed,
    success_count: created,
    error_count: fatalError ? 1 : 0,
    metadata: { ...(metadata || {}), fatal_error: fatalError ? { message: fatalError?.message || String(fatalError), code: fatalError?.code || null } : null },
    error: fatalError?.message || null
  }, { accountId }).catch(() => null);

  await updateSystemJobSchedule({ id: job.id, jobKey: job.nome }, {
    status: 'ativo',
    last_run_at: finishedAt,
    last_success_at: fatalError ? job.last_success_at : isoNow(),
    last_error: fatalError?.message || null,
    next_run_at: nextInMinutes(new Date(), 15),
    locked_at: null,
    locked_by: null
  }, { accountId: null }).catch((error) => {
    logJobError('updateSystemJobSchedule', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
  });

  return { ok: true, created, skipped, analyzed, fatalError };
}

async function runObservationAcrossTenants(job, context, analyzer) {
  const accountIds = await listTenantAccountIds();
  const results = [];
  for (const accountId of accountIds) {
    results.push(await runObservationByTenant(job, context, accountId, analyzer));
  }
  return { ok: true, accountIds, results };
}

async function runDirectorReuniaoExecutivaForAccount(job, context, accountId, windowDays = 7) {
  const startedAt = Date.now();
  let fatalError = null;
  let created = 0;
  let updated = 0;
  let scanned = 0;
  let metadata = { result: 'empty_queue', window_days: windowDays };

  try {
    const priorities = await collectExecutivePriorities(accountId, windowDays);
    scanned = priorities.length;
    for (const priority of priorities) {
      const existing = (await listExecutiveMemories({ limit: 50, categoria: priority.categoria, tipo: 'prioridade_executiva' }, { accountId, context })).items || [];
      const match = existing.find((item) =>
        String(item.origem || '') === priority.origem &&
        String(item.titulo || '').trim().toLowerCase() === String(priority.titulo || '').trim().toLowerCase() &&
        String(item.categoria || '') === String(priority.categoria || '') &&
        String(item.tipo || '') === 'prioridade_executiva'
      );
      const saved = await upsertExecutiveMemory({
        ...priority,
        metadata: {
          ...(match?.metadata || {}),
          ...(priority.metadata || {})
        }
      }, { accountId, context });
      if (match) updated += 1;
      else if (saved) created += 1;
    }
    metadata = { result: 'success', window_days: windowDays, generated: priorities.length, created, updated, scanned };
  } catch (error) {
    fatalError = error;
    metadata = { result: 'error', window_days: windowDays, created, updated, scanned };
    logJobError('runDiretorReuniaoExecutivaJob', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
  }

  const finishedAt = isoNow();
  const nextRunAt = fatalError ? nextInMinutes(new Date(), 15) : nextDaily0500(new Date());
  await recordSystemJobRun({
    job_id: job.id,
    account_id: accountId,
    nome: job.nome,
    status: fatalError ? 'error' : 'success',
    started_at: new Date(startedAt).toISOString(),
    finished_at: finishedAt,
    duration_ms: Date.now() - startedAt,
    processed_count: scanned,
    success_count: created,
    error_count: fatalError ? 1 : 0,
    metadata,
    error: fatalError?.message || null
  }, { accountId }).catch(() => null);

  await updateSystemJobSchedule({ id: job.id, jobKey: job.nome }, {
    status: 'ativo',
    last_run_at: finishedAt,
    last_success_at: fatalError ? job.last_success_at : finishedAt,
    last_error: fatalError?.message || null,
    next_run_at: nextRunAt,
    locked_at: null,
    locked_by: null
  }, { accountId: null }).catch((error) => {
    logJobError('updateSystemJobSchedule', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
  });

  return { ok: true, created, updated, scanned, fatalError, next_run_at: nextRunAt };
}

async function runHandlerForTenant(job, handler, accountId, context = {}) {
  const requestId = context.requestId || `scheduler-${job?.nome || 'unknown'}-${Date.now()}`;
  const workerId = context.workerId || `scheduler:${process.pid}`;
  return handler({ ...context, requestId, workerId, accountId, auth: { ...(context.auth || {}), accountId } });
}

async function dispatchTenantAwareJob(job, handler, context = {}) {
  const accountIds = await listTenantAccountIds();
  if (!accountIds.length) {
    logger.warn('jobs_scheduler_tenant_accounts_missing', { jobId: job.id || null, nome: job.nome || null });
    return { ok: true, skipped: true, reason: 'no_tenant_accounts', accountIds: [] };
  }

  const results = [];
  const startedAt = Date.now();
  logger.info('job_run_started', { job: job.nome || null, jobId: job.id || null, accountIds });
  for (const accountId of accountIds) {
    try {
      results.push(await runHandlerForTenant(job, handler, accountId, { ...context, schedulerManaged: true, job }));
    } catch (error) {
      results.push({ ok: false, error: error?.message || String(error), accountId });
    }
  }

  const summary = {
    accountIds,
    totalAccounts: accountIds.length,
    successes: results.filter((item) => item?.ok && !item?.error).length,
    failures: results.filter((item) => item?.error).length
  };

  await recordSystemJobRun({
    job_id: job.id,
    account_id: null,
    nome: job.nome,
    status: summary.failures ? 'error' : 'success',
    started_at: new Date().toISOString(),
    finished_at: isoNow(),
    duration_ms: 0,
    processed_count: summary.totalAccounts,
    success_count: summary.successes,
    error_count: summary.failures,
    metadata: { mode: 'tenant_fanout', ...summary },
    error: summary.failures ? 'Falha em uma ou mais execucoes por tenant' : null
  }, { accountId: null }).catch((error) => {
    logJobError('recordSystemJobRun', error, { accountId: null, requestId: context.requestId || null });
    return null;
  });

  const globalJob = await getSystemJobByLockKey(job.lock_key).catch(() => null);
  if (globalJob) {
    const nextRunAt = nextInMinutes(new Date(), 30);
    logger.info('job_next_run_updated', {
      job_key: job.nome || null,
      jobId: globalJob.id || null,
      job_id: globalJob.id || null,
      previous_next_run_at: globalJob.next_run_at || null,
      next_run_at: nextRunAt,
      schedulerManaged: true
    });
    await updateSystemJobSchedule(
      { id: globalJob.id, jobKey: globalJob.nome },
      {
        last_run_at: isoNow(),
        last_success_at: summary.failures ? globalJob.last_success_at : isoNow(),
        last_error: summary.failures ? 'Falha em uma ou mais execucoes por tenant' : null,
        next_run_at: nextRunAt,
        locked_at: null,
        locked_by: null,
        status: 'ativo'
      },
      { accountId: null }
    ).catch((error) => {
      logJobError('updateSystemJobSchedule', error, { accountId: null, requestId: context.requestId || null });
      return null;
    });
  }

  logger.info('job_run_finished', { job: job.nome || null, jobId: job.id || null, durationMs: Date.now() - startedAt, ...summary });

  return { ok: true, ...summary, results };
}

async function sendWeeklySummaryNotification({ accountId, summary, periodStart, periodEnd, jobRunId }) {
  const to = resolveJobNotificationRecipient();
  if (!to) {
    return { sent: false, skipped: true, reason: 'recipient_missing' };
  }
  const subject = `NeuralHire | Resumo operacional semanal`;
  const text = `${formatJobTextSummary(summary)}\n\nPeríodo: ${periodStart} até ${periodEnd}`;
  const html = `<div><h2>Resumo operacional semanal</h2><pre style="font-family:inherit;white-space:pre-wrap">${formatJobTextSummary(summary)}</pre><p><strong>Período:</strong> ${periodStart} até ${periodEnd}</p></div>`;
  return sendJobNotificationEmail({ to, subject, html, text, metadata: { accountId, jobRunId, type: 'weekly_summary', periodStart, periodEnd } });
}

async function sendSituacaoCadastralAlert({ accountId, cliente, situacaoCadastral, enrichedAt, jobRunId }) {
  const to = resolveJobNotificationRecipient();
  if (!to) {
    return { sent: false, skipped: true, reason: 'recipient_missing' };
  }
  const clienteNome = cliente?.nome || cliente?.razao_social || 'Cliente';
  const documento = cliente?.documento || cliente?.cnpj || '-';
  const cliente360Link = cliente?.id ? `#/clientes/${cliente.id}` : null;
  const subject = `NeuralHire | Alerta de situação cadastral: ${clienteNome}`;
  const text = [
    `Cliente: ${clienteNome}`,
    `Documento: ${documento}`,
    `Situação cadastral: ${situacaoCadastral}`,
    `Enriquecido em: ${enrichedAt}`,
    cliente360Link ? `Cliente 360: ${cliente360Link}` : null,
    'Recomendação: revisar cadastro antes de nova ação comercial.'
  ].filter(Boolean).join('\n');
  const html = `<div><h2>Alerta de situação cadastral</h2><ul><li><strong>Cliente:</strong> ${clienteNome}</li><li><strong>Documento:</strong> ${documento}</li><li><strong>Situação cadastral:</strong> ${situacaoCadastral}</li><li><strong>Enriquecido em:</strong> ${enrichedAt}</li>${cliente360Link ? `<li><strong>Cliente 360:</strong> <a href="${cliente360Link}">${cliente360Link}</a></li>` : ''}</ul><p>Recomendação: revisar cadastro antes de nova ação comercial.</p></div>`;
  return sendJobNotificationEmail({ to, subject, html, text, metadata: { accountId, jobRunId, type: 'situacao_cadastral_alert', cliente_id: cliente?.id || null, situacao_cadastral: situacaoCadastral } });
}

async function recalculateRadarClient(cliente, context, accountId) {
  const pedidos = [];
  const alertas = [];
  await calcularScoreComercialCliente({ accountId, clienteId: cliente.id, context });
  await gerarAlertasCliente(cliente.id, { accountId, context, pedidos });
  await recalcularSegmentacaoCliente(cliente.id, { accountId, context });
  await registrarEventoTimeline({
    tipo: 'radar_recalculado',
    categoria: 'radar',
    titulo: 'Radar recalculado',
    descricao: 'Cliente recalculado em lote pelo Radar Comercial.',
    metadata: { cliente_id: cliente.id, alertas_anteriores: alertas.length, pedidos: pedidos.length }
  }, { accountId, clienteId: cliente.id }).catch(() => null);
}

async function runRadarComercialForAccount(accountId, context = {}) {
  const startedAt = Date.now();
  const job = context.job || await resolveGlobalSystemJob('radar_comercial_diario') || await upsertSystemJob({
    nome: 'radar_comercial_diario',
    lock_key: canonicalJobLockKey('radar_comercial_diario'),
    account_id: null,
    status: 'ativo',
    last_run_at: isoNow(),
    next_run_at: nextDaily0300(new Date())
  }, { accountId: null });

  let processados = 0;
  let sucessos = 0;
  let falhas = 0;
  const detalhesFalhas = [];
  let fatalError = null;
  let clientes = [];

  try {
    clientes = (await listClientes({ page: 1, limit: 5000, ativo: true }, { accountId, context })).items || [];
    for (const chunk of chunkArray(clientes, 25)) {
      for (const cliente of chunk) {
        processados += 1;
        try {
          await recalculateRadarClient(cliente, context, accountId);
          sucessos += 1;
        } catch (error) {
          falhas += 1;
          detalhesFalhas.push({ cliente_id: cliente.id, erro: error?.message || String(error) });
        }
      }
    }
  } catch (error) {
    fatalError = error;
    logJobError('runRadarComercialJob', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
  } finally {
    const finishedAt = isoNow();
    const status = fatalError || falhas ? 'error' : 'success';
    const nextRunAt = fatalError || falhas ? nextInMinutes(new Date(), 15) : nextDaily0300(new Date());
    await recordSystemJobRun({
      job_id: job.id,
      account_id: accountId,
      nome: job.nome,
      status,
      started_at: new Date(startedAt).toISOString(),
      finished_at: finishedAt,
      duration_ms: Date.now() - startedAt,
      processed_count: processados,
      success_count: sucessos,
      error_count: fatalError ? Math.max(1, falhas) : falhas,
      metadata: { chunk_size: 25, fatal_error: fatalError ? { message: fatalError?.message || String(fatalError), code: fatalError?.code || null } : null, details_failures: detalhesFalhas.slice(0, 20) },
      error: fatalError?.message || (falhas ? 'Alguns clientes falharam' : null)
    }, { accountId }).catch((error) => {
      logJobError('recordSystemJobRun', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
      return null;
    });

    await updateSystemJobSchedule(
      { id: job.id, jobKey: job.nome },
      {
        last_run_at: finishedAt,
        last_success_at: fatalError || falhas ? job.last_success_at : isoNow(),
        last_error: fatalError ? (fatalError?.message || 'Falha fatal no job') : (falhas ? 'Alguns clientes falharam' : null),
        next_run_at: nextRunAt,
        locked_at: null,
        locked_by: null,
        status: 'ativo'
      },
      { accountId: null }
    ).catch((error) => {
      logJobError('updateSystemJobSchedule', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
      return null;
    });
  }

  return {
    ok: true,
    total_clientes: clientes.length,
    processados,
    sucessos,
    falhas: fatalError ? Math.max(1, falhas) : falhas,
    detalhes_falhas: detalhesFalhas,
    iniciado_em: new Date(startedAt).toISOString(),
    finalizado_em: isoNow(),
    duracao_ms: Date.now() - startedAt,
    job
  };
}

export async function runRadarComercialJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId && !context?.schedulerManaged) {
    const tenantAccountIds = await listTenantAccountIds();
    const results = [];
    for (const tenantAccountId of tenantAccountIds) {
      try {
        results.push(await runRadarComercialForAccount(tenantAccountId, { ...context, schedulerManaged: true, accountId: tenantAccountId }));
      } catch (error) {
        results.push({ ok: false, accountId: tenantAccountId, error: error?.message || String(error) });
      }
    }
    const failures = results.filter((item) => item?.ok === false || item?.falhas > 0).length;
    await recordSystemJobRun({
      job_id: (await resolveGlobalSystemJob('radar_comercial_diario'))?.id || null,
      account_id: null,
      nome: 'radar_comercial_diario',
      status: failures ? 'error' : 'success',
      started_at: isoNow(),
      finished_at: isoNow(),
      duration_ms: 0,
      processed_count: results.length,
      success_count: results.filter((item) => item?.ok && !item?.falhas).length,
      error_count: failures,
      metadata: { mode: 'tenant_fanout', tenant_count: tenantAccountIds.length, results: results.map((item) => ({ accountId: item.accountId || item?.job?.account_id || null, ok: Boolean(item?.ok), falhas: item?.falhas || 0, error: item?.error || null })) },
      error: failures ? 'Falha ao executar radar comercial em um ou mais tenants' : null
    }, { accountId: null }).catch(() => null);
    return { ok: true, mode: 'tenant_fanout', tenant_count: tenantAccountIds.length, results };
  }
  return runRadarComercialForAccount(accountId, context);
}

async function runClienteAutomacaoJob({ context = {}, lockKey, nome, ttlMinutes, nextRunIfProcessedMinutes, nextRunIfEmptyMinutes, action, selectNextCliente, executeCliente, metadataAction, schedulerManaged = false }) {
  const accountId = getAccountIdFromContext(context);
  const startedAt = Date.now();
  const canonicalLockKey = canonicalJobLockKey(nome);
  const acquired = schedulerManaged ? { acquired: true, job: null } : await acquireSystemJobLock({ lockKey: canonicalLockKey, nome, ttlMinutes, accountId: null, workerId: context.requestId || 'local' });
  if (!acquired.acquired) return { ok: true, skipped: true, job: acquired.job };

  const job = schedulerManaged
    ? (context.job || await resolveGlobalSystemJob(nome).catch(() => null)) || { id: null, nome, lock_key: canonicalJobLockKey(nome), account_id: null, status: 'ativo' }
    : await upsertSystemJob({ nome, lock_key: canonicalLockKey, account_id: null, status: 'ativo', last_run_at: isoNow(), next_run_at: nextInMinutes(new Date(), nextRunIfEmptyMinutes) }, { accountId: null });
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let metadata = { action, result: 'empty_queue', next_run_reason: 'empty_queue' };
  let fatalError = null;

  try {
    const cliente = await selectNextCliente(accountId, context);
    if (cliente) {
      processedCount = 1;
      try {
        const result = await executeCliente(cliente, context, accountId);
        successCount = 1;
        metadata = { cliente_id: cliente.id, cliente_nome: cliente.nome || null, documento: cliente.documento || null, action, result: 'success', next_run_reason: 'queue_has_items', ...(metadataAction ? { ...metadataAction(result, cliente) } : {}) };
      } catch (error) {
        errorCount = 1;
        metadata = { cliente_id: cliente.id, cliente_nome: cliente.nome || null, documento: cliente.documento || null, action, result: 'error', next_run_reason: 'queue_has_items' };
        throw error;
      }
    }
  } catch (error) {
    fatalError = error;
    if (!processedCount) metadata = { action, result: 'empty_queue', next_run_reason: 'empty_queue' };
    if (processedCount && !successCount) errorCount = 1;
    logJobError(`run${nome}`, error, { accountId, lockKey: canonicalLockKey, requestId: context.requestId || null });
  } finally {
    const finishedAt = isoNow();
    const hasItems = processedCount > 0;
    const nextRunAt = hasItems ? nextInMinutes(new Date(), nextRunIfProcessedMinutes) : nextInMinutes(new Date(), nextRunIfEmptyMinutes);
    const runStatus = fatalError ? 'error' : 'success';
    const previousNextRunAt = job?.next_run_at || null;
    logger.info('job_next_run_updated', { job_key: nome, id: job?.id || null, previous_next_run_at: previousNextRunAt, next_run_at: nextRunAt, schedulerManaged });
    await recordSystemJobRun({
      job_id: job.id,
      account_id: accountId,
      nome: job.nome,
      status: runStatus,
      started_at: new Date(startedAt).toISOString(),
      finished_at: finishedAt,
      duration_ms: Date.now() - startedAt,
      processed_count: processedCount,
      success_count: successCount,
      error_count: errorCount,
      metadata,
      error: fatalError?.message || null
    }, { accountId }).catch((error) => {
      logJobError('recordSystemJobRun', error, { accountId, lockKey: canonicalLockKey, requestId: context.requestId || null });
      return null;
    });
    await updateSystemJobSchedule(
      { id: job.id, jobKey: nome },
      {
        last_run_at: finishedAt,
        last_success_at: fatalError ? job.last_success_at : finishedAt,
        last_error: fatalError?.message || null,
        next_run_at: fatalError ? nextInMinutes(new Date(), 15) : nextRunAt,
        locked_at: null,
        locked_by: null,
        status: 'ativo'
      },
      { accountId }
    ).catch((error) => {
      logJobError('updateSystemJobSchedule', error, { accountId, lockKey: canonicalLockKey, requestId: context.requestId || null });
      return null;
    });
  }

  return { ok: true, processados: processedCount, sucessos: successCount, falhas: errorCount, job };
}

export async function runClientesEnriquecimentoJob(context = {}) {
  return runClienteAutomacaoJob({
    context,
    lockKey: canonicalJobLockKey('clientes_enriquecimento_automatico'),
    nome: 'clientes_enriquecimento_automatico',
    ttlMinutes: 30,
    nextRunIfProcessedMinutes: 30,
    nextRunIfEmptyMinutes: 60,
    action: 'enriquecimento',
    selectNextCliente: (accountId) => getNextClienteForEnrichment(accountId),
    executeCliente: async (cliente, ctx, accountId) => {
      const enrichedAt = new Date().toISOString();
      const updated = await enrichClienteByCnpj(cliente.id, { accountId, context: ctx, fetchImpl: ctx.fetchImpl });
      const situacaoCadastral = normalizeSituacaoCadastral(updated?.situacao_cadastral);
      const notificationMetadata = { notification: { type: 'situacao_cadastral_alert', sent: false, skipped: true, to: null, cliente_id: cliente.id, situacao_cadastral: situacaoCadastral || null, reason: 'situacao_cadastral_ativa' } };
      if (situacaoCadastral && !isSituacaoAtiva(situacaoCadastral)) {
        try {
          const sent = await sendSituacaoCadastralAlert({ accountId, cliente: updated || cliente, situacaoCadastral, enrichedAt, jobRunId: null });
          notificationMetadata.notification.sent = Boolean(sent?.sent);
          notificationMetadata.notification.skipped = Boolean(sent?.skipped);
          notificationMetadata.notification.to = sent?.to || null;
          delete notificationMetadata.notification.reason;
        } catch (error) {
          notificationMetadata.notification.sent = false;
          notificationMetadata.notification.skipped = false;
          notificationMetadata.notification.error = error?.message || String(error);
          console.error('[jobs.scheduler] notification_error', { type: 'situacao_cadastral_alert', account_id: accountId, cliente_id: cliente.id, message: error?.message || String(error) });
        }
      }
      return { updated, notificationMetadata };
    },
    metadataAction: (result, cliente) => ({ fonte: result?.updated?.enriquecimento_fonte || cliente?.enriquecimento_fonte || null, ...(result?.notificationMetadata || {}) }),
    schedulerManaged: Boolean(context?.schedulerManaged)
  });
}

export async function runClientesGeolocalizacaoJob(context = {}) {
  return runClienteAutomacaoJob({
    context,
    lockKey: canonicalJobLockKey('clientes_geolocalizacao_automatico'),
    nome: 'clientes_geolocalizacao_automatico',
    ttlMinutes: 30,
    nextRunIfProcessedMinutes: 30,
    nextRunIfEmptyMinutes: 60,
    action: 'geolocalizacao',
    selectNextCliente: (accountId, ctx) => getNextClienteForGeolocation(accountId, ctx),
    executeCliente: (cliente, ctx, accountId) => geolocalizarCliente({ accountId, clienteId: cliente.id, fetchImpl: ctx.fetchImpl, context: ctx }),
    metadataAction: (result) => ({ status: result?.resultado?.status || null }),
    schedulerManaged: Boolean(context?.schedulerManaged)
  });
}

function countQueueRemainingByCandidates(items = [], kind = 'enrichment') {
  return (Array.isArray(items) ? items : []).filter((cliente) => {
    const hasDocumento = Boolean(String(cliente?.documento || '').trim());
    if (!hasDocumento) return false;
    if (kind === 'geolocation') {
      return !Number.isFinite(Number(cliente.latitude)) || !Number.isFinite(Number(cliente.longitude));
    }
    return true;
  }).length;
}

async function upsertManagerObservation(context, payload) {
  return createObservationIfNotOpen(context, {
    ...payload,
    origin: payload.origin || payload.manager_id,
    metadata: {
      ...(payload.metadata || {}),
      dedupe_key: payload.metadata?.dedupe_key || payload.metadata?.dedupeKey || `${payload.manager_id}:${payload.category}:${payload.title}:${payload.source_type || 'system'}:${payload.source_id || 'global'}`
    }
  });
}

async function analyzeCommercialTenant({ accountId, context }) {
  const clientes = (await listClientes({ page: 1, limit: 5000, ativo: true }, { accountId, context })).items || [];
  const now = new Date();
  let created = 0;
  let skipped = 0;
  for (const cliente of clientes) {
    const pedidos = await listClientePedidos(accountId, cliente.id);
    const validPedidos = (Array.isArray(pedidos) ? pedidos : []).filter((pedido) => Boolean(purchaseDateFromPedido(pedido)));
    const sortedPedidos = [...validPedidos].sort((a, b) => purchaseDateFromPedido(b).getTime() - purchaseDateFromPedido(a).getTime());
    const latestPedido = sortedPedidos[0] || null;
    const previousPedido = sortedPedidos[1] || null;
    if (latestPedido) {
      const lastPurchaseDate = purchaseDateFromPedido(latestPedido);
      const daysWithoutPurchase = Math.floor((now.getTime() - lastPurchaseDate.getTime()) / 86400000);
      if (daysWithoutPurchase >= 90) {
        const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_comercial'), category: 'comercial', severity: 'high', title: 'Cliente sem compra há mais de 90 dias', description: `Cliente ${cliente.nome || 'Cliente'} não compra desde ${lastPurchaseDate.toISOString().slice(0, 10)}.`, source_type: 'cliente', source_id: cliente.id, metadata: { cliente_id: cliente.id, cliente_nome: cliente.nome || null, ultima_compra_em: lastPurchaseDate.toISOString(), dias_sem_compra: daysWithoutPurchase }, impact: 'Queda de recorrência e risco de churn', urgency: 'Alta urgência comercial' });
        outcome.created ? created += 1 : skipped += 1;
      }
      const recentPurchase = lastPurchaseDate.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const daysBetweenTwoLastPurchases = previousPedido ? Math.floor((lastPurchaseDate.getTime() - purchaseDateFromPedido(previousPedido).getTime()) / 86400000) : 0;
      if (recentPurchase && previousPedido && daysBetweenTwoLastPurchases >= 90) {
        const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_comercial'), category: 'comercial', severity: 'medium', title: 'Cliente reativado', description: `Cliente ${cliente.nome || 'Cliente'} voltou a comprar após ${daysBetweenTwoLastPurchases} dias sem compra.`, source_type: 'cliente', source_id: cliente.id, metadata: { cliente_id: cliente.id, cliente_nome: cliente.nome || null, pedido_id: latestPedido.id || null, pedido_numero: latestPedido.numero || null, data_pedido: lastPurchaseDate.toISOString(), dias_sem_compra_antes_do_pedido: daysBetweenTwoLastPurchases }, impact: 'Recuperação de carteira', urgency: 'Urgente para acompanhamento' });
        outcome.created ? created += 1 : skipped += 1;
      }
    }
    const { faturamentoAtual, faturamentoAnterior } = computeClientSalesSignals(validPedidos, now);
    if (faturamentoAnterior >= 500) {
      const quedaPercentual = faturamentoAnterior > 0 ? Math.round(((faturamentoAnterior - faturamentoAtual) / faturamentoAnterior) * 100) : 0;
      const crescimentoPercentual = faturamentoAnterior > 0 ? Math.round(((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100) : 0;
      if (quedaPercentual >= 50) {
        const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_comercial'), category: 'comercial', severity: 'high', title: 'Queda relevante de faturamento', description: `Cliente ${cliente.nome || 'Cliente'} teve queda de ${quedaPercentual}% no faturamento dos últimos 30 dias.`, source_type: 'cliente', source_id: cliente.id, metadata: { cliente_id: cliente.id, cliente_nome: cliente.nome || null, faturamento_30d_atual: faturamentoAtual, faturamento_30d_anterior: faturamentoAnterior, queda_percentual: quedaPercentual }, impact: 'Faturamento em retração', urgency: 'Alta urgência' });
        outcome.created ? created += 1 : skipped += 1;
      }
      if (faturamentoAtual >= 500 && crescimentoPercentual >= 50) {
        const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_comercial'), category: 'comercial', severity: 'medium', title: 'Crescimento relevante de faturamento', description: `Cliente ${cliente.nome || 'Cliente'} cresceu ${crescimentoPercentual}% nos últimos 30 dias.`, source_type: 'cliente', source_id: cliente.id, metadata: { cliente_id: cliente.id, cliente_nome: cliente.nome || null, faturamento_30d_atual: faturamentoAtual, faturamento_30d_anterior: faturamentoAnterior, crescimento_percentual: crescimentoPercentual }, impact: 'Oportunidade de expansão', urgency: 'Média urgência comercial' });
        outcome.created ? created += 1 : skipped += 1;
      }
    }
  }
  return { created, skipped, analyzed: clientes.length, metadata: { observations_created: created, observations_skipped_duplicate: skipped, accounts_processed: 1, clientes_analisados: clientes.length } };
}

async function analyzeProductsTenant({ accountId, context }) {
  const produtos = (await listProdutos({ page: 1, limit: 5000 }, { accountId })).items || [];
  const promocoes = (await listPromocoes({}, { accountId })).items || [];
  let created = 0;
  let skipped = 0;
  for (const produto of produtos) {
    const hasImagem = Boolean(produto.imagem_url || produto.imagemUrl || produto.foto_url);
    const hasCategoria = Boolean(produto.categoria_id || produto.categoria);
    const hasVendas = Number(produto.total_vendas || 0) > 0 || Number(produto.vendas || 0) > 0;
    if (!hasImagem) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_produtos'), category: 'produtos', severity: 'medium', title: 'Produto sem imagem', description: `Produto ${produto.nome || produto.id} está sem imagem cadastrada.`, source_type: 'produto', source_id: produto.id, metadata: { produto_id: produto.id, produto_nome: produto.nome || null }, impact: 'Baixa conversão no catálogo', urgency: 'Média urgência' });
      outcome.created ? created += 1 : skipped += 1;
    }
    if (!hasCategoria) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_produtos'), category: 'produtos', severity: 'medium', title: 'Produto sem categoria', description: `Produto ${produto.nome || produto.id} está sem categoria definida.`, source_type: 'produto', source_id: produto.id, metadata: { produto_id: produto.id, produto_nome: produto.nome || null }, impact: 'Dificulta organização e busca', urgency: 'Média urgência' });
      outcome.created ? created += 1 : skipped += 1;
    }
    if (!hasVendas) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_produtos'), category: 'produtos', severity: 'low', title: 'Produto sem vendas', description: `Produto ${produto.nome || produto.id} não apresenta vendas registradas.`, source_type: 'produto', source_id: produto.id, metadata: { produto_id: produto.id, produto_nome: produto.nome || null }, impact: 'Estoque parado e capital imobilizado', urgency: 'Baixa urgência' });
      outcome.created ? created += 1 : skipped += 1;
    }
    if (Number(produto.estoque || produto.estoque_atual || 0) <= 0) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_produtos'), category: 'produtos', severity: 'high', title: 'Produto sem estoque', description: `Produto ${produto.nome || produto.id} está sem estoque disponível.`, source_type: 'produto', source_id: produto.id, metadata: { produto_id: produto.id, produto_nome: produto.nome || null }, impact: 'Risco de perda de pedido', urgency: 'Alta urgência' });
      outcome.created ? created += 1 : skipped += 1;
    }
  }
  for (const promocao of promocoes) {
    if (promocao?.ativaAgora === false) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_produtos'), category: 'produtos', severity: 'low', title: 'Promoção vencida', description: `Promoção ${promocao.nome || promocao.id} está vencida ou inativa.`, source_type: 'promocao', source_id: promocao.id, metadata: { promocao_id: promocao.id, promocao_nome: promocao.nome || null, data_fim: promocao.data_fim || null }, impact: 'Oferta desatualizada', urgency: 'Baixa urgência' });
      outcome.created ? created += 1 : skipped += 1;
    }
  }
  return { created, skipped, analyzed: produtos.length + promocoes.length };
}

async function analyzeAuditTenant({ accountId, context }) {
  const auditLogs = (await listAuditLogs({}, { accountId })).items || [];
  const batches = await listBatches({ accountId }).catch(() => []);
  const totalIssues = auditLogs.filter((log) => String(log.status || '').toLowerCase() === 'failed' || String(log.status || '').toLowerCase() === 'error').length + batches.filter((batch) => String(batch.status || '').toLowerCase() === 'failed').length;
  const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_auditoria'), category: 'auditoria', severity: totalIssues > 0 ? 'high' : 'low', title: 'Falhas operacionais identificadas', description: `Foram identificadas ${totalIssues} ocorrências relevantes em logs, erros, importações ou jobs.`, source_type: 'operacao', source_id: 'auditoria', metadata: { audit_logs: auditLogs.length, batches: batches.length, issues: totalIssues }, impact: 'Operação sob risco', urgency: totalIssues > 0 ? 'Alta urgência operacional' : 'Baixa urgência' });
  return { created: outcome.created ? 1 : 0, skipped: outcome.created ? 0 : 1, analyzed: auditLogs.length + batches.length };
}

async function analyzeAdministrativeTenant({ accountId, context }) {
  const clientes = (await listClientes({ page: 1, limit: 5000, ativo: true }, { accountId, context })).items || [];
  let created = 0;
  let skipped = 0;
  for (const cliente of clientes) {
    if (!cliente.enriquecido_em && !cliente.enriquecimento_fonte) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_administrativo'), category: 'administrativo', severity: 'medium', title: 'Cliente sem enriquecimento', description: `Cliente ${cliente.nome || cliente.id} ainda não foi enriquecido.`, source_type: 'cliente', source_id: cliente.id, metadata: { cliente_id: cliente.id, cliente_nome: cliente.nome || null }, impact: 'Cadastro incompleto', urgency: 'Média urgência administrativa' });
      outcome.created ? created += 1 : skipped += 1;
    }
    if (!Number.isFinite(Number(cliente.latitude)) || !Number.isFinite(Number(cliente.longitude))) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_administrativo'), category: 'administrativo', severity: 'medium', title: 'Cliente sem geolocalização', description: `Cliente ${cliente.nome || cliente.id} não possui geolocalização válida.`, source_type: 'cliente', source_id: cliente.id, metadata: { cliente_id: cliente.id, cliente_nome: cliente.nome || null }, impact: 'Reduz precisão operacional', urgency: 'Média urgência administrativa' });
      outcome.created ? created += 1 : skipped += 1;
    }
    if (!cliente.documento || String(cliente.documento).replace(/\D/g, '').length < 11) {
      const outcome = await upsertManagerObservation(context, { ...observationContext('gerente_administrativo'), category: 'administrativo', severity: 'high', title: 'Cadastro inválido', description: `Cliente ${cliente.nome || cliente.id} possui cadastro/documento inválido.`, source_type: 'cliente', source_id: cliente.id, metadata: { cliente_id: cliente.id, cliente_nome: cliente.nome || null, documento: cliente.documento || null }, impact: 'Risco de integridade cadastral', urgency: 'Alta urgência administrativa' });
      outcome.created ? created += 1 : skipped += 1;
    }
  }
  return { created, skipped, analyzed: clientes.length };
}

export async function runNotificacoesResumoSemanalJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const startedAt = Date.now();
  const job = context.job || await resolveGlobalSystemJob('notificacoes_resumo_semanal') || await upsertSystemJob({ nome: 'notificacoes_resumo_semanal', lock_key: canonicalJobLockKey('notificacoes_resumo_semanal'), account_id: null, status: 'ativo', last_run_at: isoNow(), next_run_at: nextInMinutes(new Date(), 60 * 24 * 7) }, { accountId: null });
  const periodEndDate = new Date();
  const periodStartDate = new Date(periodEndDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const periodStart = periodStartDate.toISOString();
  const periodEnd = periodEndDate.toISOString();
  const baseNotification = { type: 'weekly_summary', sent: false, skipped: false, to: null, periodStart, periodEnd };
  let metadata = { notification: { ...baseNotification } };

  try {
    const [runsResult, clientesResult] = await Promise.all([
      listSystemJobRuns(accountId, { startedAfter: periodStart }),
      listClientes({ page: 1, limit: 5000, ativo: true }, { accountId, context })
    ]);
    const runs = Array.isArray(runsResult) ? runsResult : [];
    const clientes = Array.isArray(clientesResult?.items) ? clientesResult.items : [];
    const summary = {
      clientes_enriquecidos: runs.filter((run) => run.nome === 'clientes_enriquecimento_automatico' && Number(run.success_count || 0) > 0).length,
      clientes_geolocalizados: runs.filter((run) => run.nome === 'clientes_geolocalizacao_automatico' && Number(run.success_count || 0) > 0).length,
      erros_enriquecimento: runs.filter((run) => run.nome === 'clientes_enriquecimento_automatico' && Number(run.error_count || 0) > 0).length,
      erros_geolocalizacao: runs.filter((run) => run.nome === 'clientes_geolocalizacao_automatico' && Number(run.error_count || 0) > 0).length,
      clientes_situacao_irregular: clientes.filter((cliente) => cliente?.situacao_cadastral && !isSituacaoAtiva(cliente.situacao_cadastral)).length,
      fila_enriquecimento_restante: countQueueRemainingByCandidates(clientes, 'enrichment'),
      fila_geolocalizacao_restante: countQueueRemainingByCandidates(clientes, 'geolocation')
    };

    try {
      const sent = await sendWeeklySummaryNotification({ accountId, summary, periodStart, periodEnd, jobRunId: null });
      metadata.notification = { ...metadata.notification, sent: Boolean(sent?.sent), skipped: Boolean(sent?.skipped), to: sent?.to || null };
      if (sent?.reason === 'recipient_missing') metadata.notification_skipped = true;
    } catch (error) {
      metadata.notification.sent = false;
      metadata.notification.error = error?.message || String(error);
      console.error('[jobs.scheduler] notification_error', { type: 'weekly_summary', account_id: accountId, message: error?.message || String(error) });
    }

    await recordSystemJobRun({
      job_id: job.id,
      account_id: accountId,
      nome: job.nome,
      status: 'success',
      started_at: new Date(startedAt).toISOString(),
      finished_at: isoNow(),
      duration_ms: Date.now() - startedAt,
      processed_count: 0,
      success_count: 0,
      error_count: 0,
      metadata,
      error: null
    }, { accountId }).catch((error) => {
      logJobError('recordSystemJobRun', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
      return null;
    });

    await releaseSystemJobLock(job.lock_key, { locked_at: null, locked_by: null }).catch((error) => {
      logJobError('releaseSystemJobLock', error, { accountId, lockKey: job.lock_key, requestId: context.requestId || null });
      return null;
    });
    await updateSystemJobSchedule({ id: job.id, jobKey: job.nome }, { status: 'ativo', last_success_at: isoNow(), last_error: null, next_run_at: new Date(periodEndDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), locked_at: null, locked_by: null, last_run_at: isoNow() }, { accountId: null });
  } catch (error) {
    await recordSystemJobRun({
      job_id: job.id,
      account_id: accountId,
      nome: job.nome,
      status: 'error',
      started_at: new Date(startedAt).toISOString(),
      finished_at: isoNow(),
      duration_ms: Date.now() - startedAt,
      processed_count: 0,
      success_count: 0,
      error_count: 1,
      metadata,
      error: error?.message || String(error)
    }, { accountId }).catch(() => null);
    await releaseSystemJobLock(job.lock_key, { locked_at: null, locked_by: null }).catch(() => null);
    throw error;
  }

  return { ok: true, job };
}

export async function runGerenteComercialObservacaoJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const startedAt = Date.now();
  const job = context.job || await resolveGlobalSystemJob('gerente_comercial_observacao') || await upsertSystemJob({
    nome: 'gerente_comercial_observacao',
    lock_key: canonicalJobLockKey('gerente_comercial_observacao'),
    account_id: null,
    status: 'ativo',
    last_run_at: isoNow(),
    next_run_at: nextDaily0300(new Date())
  }, { accountId: null });
  if (!accountId) return runObservationAcrossTenants(job, context, analyzeCommercialTenant);
  return runObservationByTenant(job, context, accountId, analyzeCommercialTenant);
}

export async function runGerenteProdutosObservacaoJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const job = context.job || await resolveGlobalSystemJob('gerente_produtos_observacao') || await upsertSystemJob({ nome: 'gerente_produtos_observacao', lock_key: canonicalJobLockKey('gerente_produtos_observacao'), account_id: null, status: 'ativo', last_run_at: isoNow(), next_run_at: nextDaily0300(new Date()) }, { accountId: null });
  return accountId ? runObservationByTenant(job, context, accountId, analyzeProductsTenant) : runObservationAcrossTenants(job, context, analyzeProductsTenant);
}

export async function runGerenteAuditoriaObservacaoJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const job = context.job || await resolveGlobalSystemJob('gerente_auditoria_observacao') || await upsertSystemJob({ nome: 'gerente_auditoria_observacao', lock_key: canonicalJobLockKey('gerente_auditoria_observacao'), account_id: null, status: 'ativo', last_run_at: isoNow(), next_run_at: nextDaily0300(new Date()) }, { accountId: null });
  return accountId ? runObservationByTenant(job, context, accountId, analyzeAuditTenant) : runObservationAcrossTenants(job, context, analyzeAuditTenant);
}

export async function runGerenteAdministrativoObservacaoJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const job = context.job || await resolveGlobalSystemJob('gerente_administrativo_observacao') || await upsertSystemJob({ nome: 'gerente_administrativo_observacao', lock_key: canonicalJobLockKey('gerente_administrativo_observacao'), account_id: null, status: 'ativo', last_run_at: isoNow(), next_run_at: nextDaily0300(new Date()) }, { accountId: null });
  return accountId ? runObservationByTenant(job, context, accountId, analyzeAdministrativeTenant) : runObservationAcrossTenants(job, context, analyzeAdministrativeTenant);
}

export async function runDiretorReuniaoExecutivaJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const job = context.job || await resolveGlobalSystemJob('diretor_reuniao_executiva') || await upsertSystemJob({
    nome: 'diretor_reuniao_executiva',
    lock_key: canonicalJobLockKey('diretor_reuniao_executiva'),
    account_id: null,
    status: 'ativo',
    last_run_at: isoNow(),
    next_run_at: nextDaily0500(new Date())
  }, { accountId: null });

  if (!accountId) {
    const accountIds = await listTenantExecutiveAccounts();
    const results = [];
    for (const tenantAccountId of accountIds) {
      results.push(await runDirectorReuniaoExecutivaForAccount(job, context, tenantAccountId, 7));
    }
    return { ok: true, mode: 'tenant_fanout', accountIds, results };
  }

  return runDirectorReuniaoExecutivaForAccount(job, context, accountId, Number(context.query?.window_days || 7) || 7);
}

export async function listJobsOverview(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, items: await listSystemJobs(accountId) };
}

export async function dispatchDueJob(job, context = {}) {
  const handler = JOB_HANDLERS[job?.nome];
  const requestId = context.requestId || `scheduler-${job?.nome || 'unknown'}-${Date.now()}`;
  const workerId = context.workerId || `scheduler:${process.pid}`;
  if (!handler) {
    logger.warn('jobs_scheduler_job_unknown_handler', { requestId, workerId, jobId: job?.id || null, nome: job?.nome || null, nextRunAt: job?.next_run_at || null });
    return { ok: false, skipped: true, reason: 'unknown_handler' };
  }

  logger.info('jobs_scheduler_job_dispatched', {
    requestId,
    workerId,
    jobId: job.id || null,
    nome: job.nome || null,
    nextRunAt: job.next_run_at || null
  });

  try {
    const result = TENANT_AWARE_JOB_NAMES.has(job?.nome)
      ? await dispatchTenantAwareJob(job, handler, { ...context, requestId, workerId })
      : await handler({ ...context, requestId, workerId, accountId: job.account_id || context.accountId || null, auth: { ...(context.auth || {}), accountId: job.account_id || context.accountId || null } });
    return { ok: true, result };
  } catch (error) {
    logger.error('jobs_scheduler_job_failed', {
      requestId,
      workerId,
      jobId: job.id || null,
      nome: job.nome || null,
      nextRunAt: job.next_run_at || null,
      message: error?.message || String(error)
    });
    throw error;
  }
}

export async function runJobsSchedulerTick({ now = new Date(), limit = 10, accountId = null, workerId = `scheduler:${process.pid}` } = {}) {
  const requestId = `scheduler-tick-${now instanceof Date ? now.getTime() : Date.now()}`;
  const startedAt = Date.now();
  logger.info('jobs_scheduler_tick_started', { requestId, workerId, accountId: accountId || null, limit });

  let dueJobs = [];
  try {
    dueJobs = await listDueSystemJobs({ now, limit, accountId });
    logger.info('due_jobs_found', {
      requestId,
      workerId,
      accountId: accountId || null,
      now: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
      jobs: dueJobs.map((job) => ({
        id: job.id || null,
        job_key: job.nome || null,
        next_run_at: job.next_run_at || null
      }))
    });
    for (const job of dueJobs) {
      if (job?.next_run_at && new Date(job.next_run_at).getTime() > new Date(now).getTime()) {
        logger.warn('job_due_future_detected', {
          requestId,
          workerId,
          job_key: job.nome || null,
          id: job.id || null,
          now: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
          next_run_at: job.next_run_at,
          diff_ms: new Date(job.next_run_at).getTime() - new Date(now).getTime()
        });
      }
      void Promise.resolve()
        .then(() => dispatchDueJob(job, { requestId: `scheduler-${job.nome}-${Date.now()}`, workerId, accountId: job.account_id || accountId || null, auth: { accountId: job.account_id || accountId || null } }))
        .catch((error) => {
          logger.error('jobs_scheduler_job_failed', {
            requestId,
            workerId,
            jobId: job?.id || null,
            nome: job?.nome || null,
            nextRunAt: job?.next_run_at || null,
            message: error?.message || String(error)
          });
        });
    }
  } catch (error) {
    logger.error('jobs_scheduler_tick_failed', { requestId, workerId, accountId: accountId || null, message: error?.message || String(error) });
    throw error;
  } finally {
    logger.info('jobs_scheduler_tick_finished', { requestId, workerId, accountId: accountId || null, durationMs: Date.now() - startedAt, dueJobsCount: dueJobs.length });
  }

  return { ok: true, dueJobsCount: dueJobs.length };
}

export function startJobsScheduler({ intervalMs = Number(process.env.JOBS_SCHEDULER_INTERVAL_MS) || 60000, accountId = null } = {}) {
  if (schedulerTimer) return { started: false, reason: 'already_started' };
  schedulerRunning = true;
  const workerId = `scheduler:${process.pid}`;
  void runJobsSchedulerTick({ accountId, workerId }).catch((error) => {
    logger.error('jobs_scheduler_tick_failed', { workerId, accountId: accountId || null, message: error?.message || String(error) });
  });
  schedulerTimer = setInterval(() => {
    if (!schedulerRunning) return;
    void runJobsSchedulerTick({ accountId, workerId }).catch((error) => {
      logger.error('jobs_scheduler_tick_failed', { workerId, accountId: accountId || null, message: error?.message || String(error) });
    });
  }, Math.max(1000, Number(intervalMs) || 60000));
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
  logger.info('jobs_scheduler_started', { intervalMs: Math.max(1000, Number(intervalMs) || 60000), env: process.env.NODE_ENV || null });
  return { started: true, intervalMs: Math.max(1000, Number(intervalMs) || 60000) };
}

export function stopJobsScheduler() {
  schedulerRunning = false;
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
}

export function __resetJobsSchedulerForTests() {
  stopJobsScheduler();
}
