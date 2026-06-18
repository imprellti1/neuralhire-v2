import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { logger } from '../../core/logger.js';
import { listJobsOverview, runClientesEnriquecimentoJob, runClientesGeolocalizacaoJob, runGerenteComercialObservacaoJob, runNotificacoesResumoSemanalJob, runRadarComercialJob } from './jobs.scheduler.js';
import { getSystemJobById, listSystemJobRuns, listSystemJobRunsForJob, listSystemJobs } from './jobs.repository.js';

function assertJobAdmin(context) {
  const role = String(context?.auth?.role || '').toLowerCase();
  if (!['owner', 'admin', 'account_admin', 'super_admin'].includes(role)) {
    throw new ForbiddenError('Permissao insuficiente para executar jobs', { code: 'JOB_FORBIDDEN', domain: 'system-jobs' });
  }
}

export async function getJobsAdmin(context = {}) {
  assertJobAdmin(context);
  getAccountIdFromContext(context);
  return listJobsOverview(context);
}

export async function getJobsListAdmin(context = {}) {
  assertJobAdmin(context);
  const accountId = getAccountIdFromContext(context);
  return { ok: true, items: await listSystemJobs(accountId) };
}

export async function getJobsRunsAdmin(context = {}) {
  assertJobAdmin(context);
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  return {
    ok: true,
    items: await listSystemJobRuns(accountId, {
      nome: query.nome || '',
      status: query.status || '',
      jobId: query.job_id || '',
      limit: query.limit || 20,
      startedAfter: query.started_after || ''
    })
  };
}

export async function getJobDetailAdmin(context = {}) {
  assertJobAdmin(context);
  const accountId = getAccountIdFromContext(context);
  const id = String(context.params?.id || '').trim();
  const item = await getSystemJobById(id, accountId);
  if (!item) {
    throw new NotFoundError('Job nao encontrado', { code: 'JOB_NOT_FOUND', domain: 'system-jobs' });
  }
  return { ok: true, item, runs: await listSystemJobRunsForJob(item.id, accountId, { limit: 10 }) };
}

async function resolveAdminJobForManualRun(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context.params?.id || '').trim();
  const normalizedId = id.replace(/-/g, '_');
  const jobs = await listSystemJobs(null);
  let item = jobs.find((job) => String(job.id) === String(id)) || null;
  if (!item) item = jobs.find((job) => String(job.nome) === normalizedId || String(job.lock_key) === id || String(job.nome) === id) || null;
  if (!item && accountId) item = await getSystemJobById(id, accountId);
  if (!item) {
    throw new NotFoundError('Job nao encontrado', { code: 'JOB_NOT_FOUND', domain: 'system-jobs' });
  }
  return item;
}

function enqueueManualJobRun(job, context, runner) {
  const accountId = getAccountIdFromContext(context);
  const workerId = context?.requestId || 'local';
  const requestId = context?.requestId || null;

  void Promise.resolve()
    .then(() => runner({ ...context, accountId, workerId, requestId }))
    .catch((error) => {
      logger.error({
        message: 'Falha na execução assíncrona do job manual',
        error: error?.message || String(error),
        requestId,
        account_id: accountId,
        job_id: job?.id || null,
        job_key: job?.nome || null
      });
    });

  return { success: true, message: 'Job iniciado', status: 'running', job_id: job.id, job_key: job.nome };
}

export async function runJobManualAdmin(context = {}) {
  assertJobAdmin(context);
  const job = await resolveAdminJobForManualRun(context);
  const runners = {
    radar_comercial_diario: runRadarComercialJob,
    clientes_enriquecimento_automatico: runClientesEnriquecimentoJob,
    clientes_geolocalizacao_automatico: runClientesGeolocalizacaoJob,
    notificacoes_resumo_semanal: runNotificacoesResumoSemanalJob,
    gerente_comercial_observacao: runGerenteComercialObservacaoJob
  };
  const runner = runners[job.nome];
  if (!runner) throw new NotFoundError('Job sem handler', { code: 'JOB_HANDLER_NOT_FOUND', domain: 'system-jobs' });
  return enqueueManualJobRun(job, context, runner);
}
