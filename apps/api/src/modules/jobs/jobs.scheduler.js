import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { logger } from '../../core/logger.js';
import { listClientes } from '../clientes/clientes.repository.js';
import { enrichClienteByCnpj, geolocalizarCliente, getNextClienteForEnrichment, getNextClienteForGeolocation } from '../clientes/clientes.repository.js';
import { gerarAlertasCliente } from '../clientes/clientes.alerts.service.js';
import { recalcularSegmentacaoCliente } from '../clientes/clientes.segmentacao.service.js';
import { registrarEventoTimeline } from '../clientes/clientes.timeline.service.js';
import { calcularScoreComercialCliente } from '../clientes/clientes.repository.js';
import { acquireSystemJobLock, listDueSystemJobs, listSystemJobRuns, listSystemJobs, recordSystemJobRun, releaseSystemJobLock, upsertSystemJob } from './jobs.repository.js';
import { resolveJobNotificationRecipient, sendJobNotificationEmail } from '../notifications/notifications.email.service.js';

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
  notificacoes_resumo_semanal: runNotificacoesResumoSemanalJob
};

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

export async function runRadarComercialJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const lockKey = `${accountId}:jobs:radar_comercial_diario`;
  const acquired = await acquireSystemJobLock({ lockKey, nome: 'radar_comercial_diario', ttlMinutes: 120, accountId, workerId: context.requestId || 'local' });
  if (!acquired.acquired) {
    return { ok: true, skipped: true, job: acquired.job };
  }

  const startedAt = Date.now();
  const job = await upsertSystemJob({
    nome: 'radar_comercial_diario',
    lock_key: lockKey,
    account_id: accountId,
    status: 'running',
    last_run_at: isoNow(),
    next_run_at: nextDaily0300(new Date())
  }, { accountId });

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
    logJobError('runRadarComercialJob', error, { accountId, lockKey, requestId: context.requestId || null });
  } finally {
    const finishedAt = isoNow();
    const status = fatalError || falhas ? 'error' : 'success';
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
      metadata: { chunk_size: 25, fatal_error: fatalError ? { message: fatalError?.message || String(fatalError), code: fatalError?.code || null } : null },
      error: fatalError?.message || (falhas ? 'Alguns clientes falharam' : null)
    }, { accountId }).catch((error) => {
      logJobError('recordSystemJobRun', error, { accountId, lockKey, requestId: context.requestId || null });
      return null;
    });

    await releaseSystemJobLock(lockKey, { status, locked_at: null, locked_by: null }).catch((error) => {
      logJobError('releaseSystemJobLock', error, { accountId, lockKey, requestId: context.requestId || null });
      return null;
    });
  }

  await upsertSystemJob({
    ...job,
    status: fatalError || falhas ? 'error' : 'success',
    last_success_at: fatalError || falhas ? job.last_success_at : isoNow(),
    last_error: fatalError ? (fatalError?.message || 'Falha fatal no job') : (falhas ? 'Alguns clientes falharam' : null),
    next_run_at: nextDaily0300(new Date())
  }, { accountId });

  const finishedAt = isoNow();
  return {
    ok: true,
    total_clientes: clientes.length,
    processados,
    sucessos,
    falhas: fatalError ? Math.max(1, falhas) : falhas,
    detalhes_falhas: detalhesFalhas,
    iniciado_em: new Date(startedAt).toISOString(),
    finalizado_em: finishedAt,
    duracao_ms: Date.now() - startedAt,
    job
  };
}

async function runClienteAutomacaoJob({ context = {}, lockKey, nome, ttlMinutes, nextRunIfProcessedMinutes, nextRunIfEmptyMinutes, action, selectNextCliente, executeCliente, metadataAction }) {
  const accountId = getAccountIdFromContext(context);
  const acquired = await acquireSystemJobLock({ lockKey, nome, ttlMinutes, accountId, workerId: context.requestId || 'local' });
  if (!acquired.acquired) return { ok: true, skipped: true, job: acquired.job };

  const startedAt = Date.now();
  const job = await upsertSystemJob({ nome, lock_key: lockKey, account_id: accountId, status: 'running', last_run_at: isoNow(), next_run_at: nextInMinutes(new Date(), nextRunIfEmptyMinutes) }, { accountId });
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
    logJobError(`run${nome}`, error, { accountId, lockKey, requestId: context.requestId || null });
  } finally {
    const finishedAt = isoNow();
    const hasItems = processedCount > 0;
    const status = fatalError && hasItems ? 'error' : 'success';
    const nextRunAt = hasItems ? nextInMinutes(new Date(), nextRunIfProcessedMinutes) : nextInMinutes(new Date(), nextRunIfEmptyMinutes);
    await recordSystemJobRun({
      job_id: job.id,
      account_id: accountId,
      nome: job.nome,
      status,
      started_at: new Date(startedAt).toISOString(),
      finished_at: finishedAt,
      duration_ms: Date.now() - startedAt,
      processed_count: processedCount,
      success_count: successCount,
      error_count: errorCount,
      metadata,
      error: fatalError?.message || null
    }, { accountId }).catch((error) => {
      logJobError('recordSystemJobRun', error, { accountId, lockKey, requestId: context.requestId || null });
      return null;
    });
    await releaseSystemJobLock(lockKey, { status: 'idle', locked_at: null, locked_by: null, next_run_at: nextRunAt }).catch((error) => {
      logJobError('releaseSystemJobLock', error, { accountId, lockKey, requestId: context.requestId || null });
      return null;
    });
    await upsertSystemJob({ ...job, status, last_success_at: status === 'success' ? isoNow() : job.last_success_at, last_error: fatalError?.message || null, next_run_at: nextRunAt }, { accountId });
  }

  return { ok: true, processados: processedCount, sucessos: successCount, falhas: errorCount, job };
}

export async function runClientesEnriquecimentoJob(context = {}) {
  return runClienteAutomacaoJob({
    context,
    lockKey: `${getAccountIdFromContext(context)}:clientes:enriquecimento:automatico`,
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
    metadataAction: (result, cliente) => ({ fonte: result?.updated?.enriquecimento_fonte || cliente?.enriquecimento_fonte || null, ...(result?.notificationMetadata || {}) })
  });
}

export async function runClientesGeolocalizacaoJob(context = {}) {
  return runClienteAutomacaoJob({
    context,
    lockKey: `${getAccountIdFromContext(context)}:clientes:geolocalizacao:automatico`,
    nome: 'clientes_geolocalizacao_automatico',
    ttlMinutes: 30,
    nextRunIfProcessedMinutes: 30,
    nextRunIfEmptyMinutes: 60,
    action: 'geolocalizacao',
    selectNextCliente: (accountId, ctx) => getNextClienteForGeolocation(accountId, ctx),
    executeCliente: (cliente, ctx, accountId) => geolocalizarCliente({ accountId, clienteId: cliente.id, fetchImpl: ctx.fetchImpl, context: ctx }),
    metadataAction: (result) => ({ status: result?.resultado?.status || null })
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

export async function runNotificacoesResumoSemanalJob(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const lockKey = `${accountId}:notificacoes:resumo-semanal`;
  const acquired = await acquireSystemJobLock({ lockKey, nome: 'notificacoes_resumo_semanal', ttlMinutes: 30, accountId, workerId: context.requestId || 'local' });
  if (!acquired.acquired) return { ok: true, skipped: true, job: acquired.job };

  const startedAt = Date.now();
  const job = await upsertSystemJob({ nome: 'notificacoes_resumo_semanal', lock_key: lockKey, account_id: accountId, status: 'running', last_run_at: isoNow(), next_run_at: nextInMinutes(new Date(), 60 * 24 * 7) }, { accountId });
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
      logJobError('recordSystemJobRun', error, { accountId, lockKey, requestId: context.requestId || null });
      return null;
    });

    await releaseSystemJobLock(lockKey, { status: 'idle', locked_at: null, locked_by: null }).catch((error) => {
      logJobError('releaseSystemJobLock', error, { accountId, lockKey, requestId: context.requestId || null });
      return null;
    });
    await upsertSystemJob({ ...job, status: 'success', last_success_at: isoNow(), last_error: null, next_run_at: new Date(periodEndDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() }, { accountId });
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
    await releaseSystemJobLock(lockKey, { status: 'idle', locked_at: null, locked_by: null }).catch(() => null);
    throw error;
  }

  return { ok: true, job };
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
    const accountId = job.account_id || context.accountId || null;
    const result = await handler({ ...context, requestId, workerId, accountId, auth: { ...(context.auth || {}), accountId } });
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
    logger.info('jobs_scheduler_due_jobs_found', { requestId, workerId, accountId: accountId || null, count: dueJobs.length });
    for (const job of dueJobs) {
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
