import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import { createAiDirectorObservationHandler, getAiDirectorObservationHandler, listAiDirectorObservationsHandler, patchAiDirectorObservationHandler } from './ai-director-observations.controller.js';

export function registerAiDirectorObservationsRoutes(router) {
  const middlewares = [requireTenant({ domain: 'ai-director-observations' })];
  router.registerRoute({ method: 'GET', path: '/ai-director/observations', domain: 'ai-director-observations', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await listAiDirectorObservationsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-director/observations/:id', domain: 'ai-director-observations', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getAiDirectorObservationHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/ai-director/observations', domain: 'ai-director-observations', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await createAiDirectorObservationHandler(context), 201)) });
  router.registerRoute({ method: 'PATCH', path: '/ai-director/observations/:id', domain: 'ai-director-observations', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await patchAiDirectorObservationHandler(context))) });
}
