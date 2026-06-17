import { ForbiddenError } from '../../core/errors.js';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { logger } from '../../core/logger.js';
import { listJobsOverview, runClientesEnriquecimentoJob, runClientesGeolocalizacaoJob, runNotificacoesResumoSemanalJob, runRadarComercialJob } from './jobs.scheduler.js';

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

export async function runRadarComercialAdmin(context = {}) {
  assertJobAdmin(context);
  const accountId = getAccountIdFromContext(context);
  const workerId = context?.requestId || 'local';
  const requestId = context?.requestId || null;

  void Promise.resolve()
    .then(() => runRadarComercialJob({ ...context, accountId, workerId, requestId }))
    .catch((error) => {
      logger.error({
        message: 'Falha na execução assíncrona do Radar Comercial',
        error: error?.message || String(error),
        requestId,
        account_id: accountId
      });
    });

  return {
    success: true,
    message: 'Radar Comercial iniciado',
    status: 'running'
  };
}

export async function runClientesEnriquecimentoAdmin(context = {}) {
  assertJobAdmin(context);
  const accountId = getAccountIdFromContext(context);
  const workerId = context?.requestId || 'local';
  const requestId = context?.requestId || null;

  void Promise.resolve()
    .then(() => runClientesEnriquecimentoJob({ ...context, accountId, workerId, requestId }))
    .catch((error) => {
      logger.error({
        message: 'Falha na execução assíncrona do job de enriquecimento automático',
        error: error?.message || String(error),
        requestId,
        account_id: accountId
      });
    });

  return { success: true, message: 'Job iniciado', status: 'running' };
}

export async function runClientesGeolocalizacaoAdmin(context = {}) {
  assertJobAdmin(context);
  const accountId = getAccountIdFromContext(context);
  const workerId = context?.requestId || 'local';
  const requestId = context?.requestId || null;

  void Promise.resolve()
    .then(() => runClientesGeolocalizacaoJob({ ...context, accountId, workerId, requestId }))
    .catch((error) => {
      logger.error({
        message: 'Falha na execução assíncrona do job de geolocalização automático',
        error: error?.message || String(error),
        requestId,
        account_id: accountId
      });
    });

  return { success: true, message: 'Job iniciado', status: 'running' };
}

export async function runNotificacoesResumoSemanalAdmin(context = {}) {
  assertJobAdmin(context);
  const accountId = getAccountIdFromContext(context);
  const workerId = context?.requestId || 'local';
  const requestId = context?.requestId || null;

  void Promise.resolve()
    .then(() => runNotificacoesResumoSemanalJob({ ...context, accountId, workerId, requestId }))
    .catch((error) => {
      logger.error({
        message: 'Falha na execução assíncrona do job de notificações resumo semanal',
        error: error?.message || String(error),
        requestId,
        account_id: accountId
      });
    });

  return { success: true, message: 'Job iniciado', status: 'running' };
}
