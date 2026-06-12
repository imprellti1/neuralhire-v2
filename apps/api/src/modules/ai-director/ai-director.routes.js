import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getAiDirectorDashboardHandler } from './ai-director.controller.js';

export function registerAiDirectorRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/ai-director/dashboard',
    domain: 'ai-director',
    handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await getAiDirectorDashboardHandler(context)))
  });
}
