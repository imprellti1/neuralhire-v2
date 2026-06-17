import { ForbiddenError } from '../../core/errors.js';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { listJobsOverview, runRadarComercialJob } from './jobs.scheduler.js';

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
  return runRadarComercialJob(context);
}
