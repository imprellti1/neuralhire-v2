import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getJobsAdmin, runRadarComercialAdmin } from './jobs.controller.js';

export function registerJobsRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/jobs', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobsAdmin(context))) });
  router.registerRoute({ method: 'POST', path: '/jobs/radar-comercial/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await runRadarComercialAdmin(context))) });
}
