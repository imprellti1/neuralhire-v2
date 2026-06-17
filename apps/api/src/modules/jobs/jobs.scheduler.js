import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { listClientes } from '../clientes/clientes.repository.js';
import { enrichClienteByCnpj, geolocalizarCliente, getNextClienteForEnrichment, getNextClienteForGeolocation } from '../clientes/clientes.repository.js';
import { gerarAlertasCliente } from '../clientes/clientes.alerts.service.js';
import { recalcularSegmentacaoCliente } from '../clientes/clientes.segmentacao.service.js';
import { registrarEventoTimeline } from '../clientes/clientes.timeline.service.js';
import { calcularScoreComercialCliente } from '../clientes/clientes.repository.js';
import { acquireSystemJobLock, listSystemJobs, recordSystemJobRun, releaseSystemJobLock, upsertSystemJob } from './jobs.repository.js';

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
    executeCliente: (cliente, ctx, accountId) => enrichClienteByCnpj(cliente.id, { accountId, context: ctx, fetchImpl: ctx.fetchImpl }),
    metadataAction: (result, cliente) => ({ fonte: result?.enriquecimento_fonte || cliente?.enriquecimento_fonte || null })
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

export async function listJobsOverview(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, items: await listSystemJobs(accountId) };
}
