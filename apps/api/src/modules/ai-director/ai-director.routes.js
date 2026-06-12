import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { consultAiDirectorManagerHandler, createAiDirectorMemoryHandler, delegateAiDirectorQuestionHandler, getAiDirectorDashboardHandler, listAiDirectorMemoriesHandler, listAiDirectorManagersHandler } from './ai-director.controller.js';

export function registerAiDirectorRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/ai-director/dashboard',
    domain: 'ai-director',
    handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await getAiDirectorDashboardHandler(context)))
  });
  router.registerRoute({
    method: 'GET',
    path: '/ai-director/memories',
    domain: 'ai-director',
    handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await listAiDirectorMemoriesHandler(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/ai-director/memories',
    domain: 'ai-director',
    handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await createAiDirectorMemoryHandler(context), 201))
  });
  router.registerRoute({
    method: 'GET',
    path: '/ai-director/managers',
    domain: 'ai-director',
    handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await listAiDirectorManagersHandler(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/ai-director/managers/:id/consult',
    domain: 'ai-director',
    handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await consultAiDirectorManagerHandler(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/ai-director/delegate',
    domain: 'ai-director',
    handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await delegateAiDirectorQuestionHandler(context)))
  });
}
