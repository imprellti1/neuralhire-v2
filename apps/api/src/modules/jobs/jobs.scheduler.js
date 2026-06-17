import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { listClientes } from '../clientes/clientes.repository.js';
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

  try {
    const clientes = (await listClientes({ page: 1, limit: 5000, ativo: true }, { accountId, context })).items || [];
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
  } finally {
    await releaseSystemJobLock(lockKey, { status: falhas ? 'error' : 'success', locked_at: null, locked_by: null }).catch(() => null);
  }

  const finishedAt = isoNow();
  const run = await recordSystemJobRun({
    job_id: job.id,
    account_id: accountId,
    nome: job.nome,
    status: falhas ? 'error' : 'success',
    started_at: new Date(startedAt).toISOString(),
    finished_at: finishedAt,
    duration_ms: Date.now() - startedAt,
    processed_count: processados,
    success_count: sucessos,
    error_count: falhas,
    metadata: { chunk_size: 25 }
  }, { accountId });

  await upsertSystemJob({
    ...job,
    status: falhas ? 'error' : 'success',
    last_success_at: falhas ? job.last_success_at : finishedAt,
    last_error: falhas ? 'Alguns clientes falharam' : null,
    next_run_at: nextDaily0300(new Date())
  }, { accountId });

  return {
    ok: true,
    total_clientes: clientes.length,
    processados,
    sucessos,
    falhas,
    detalhes_falhas: detalhesFalhas,
    iniciado_em: new Date(startedAt).toISOString(),
    finalizado_em: finishedAt,
    duracao_ms: Date.now() - startedAt,
    job,
    run
  };
}

export async function listJobsOverview(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, items: await listSystemJobs(accountId) };
}
