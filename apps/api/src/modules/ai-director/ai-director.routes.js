import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { archiveAiDirectorEventHandler, createAiDirectorEventHandler, getAiDirectorAgentsHandler, getAiDirectorEventsHandler, getAiDirectorOverviewHandler, getAiDirectorRecommendationsHandler, markAiDirectorEventReadHandler } from './ai-director.controller.js';

export function registerAiDirectorRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/ai-director/overview', domain: 'ai-director', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiDirectorOverviewHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-director/agents', domain: 'ai-director', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiDirectorAgentsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-director/events', domain: 'ai-director', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiDirectorEventsHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/ai-director/events', domain: 'ai-director', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createAiDirectorEventHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/ai-director/events/:id/read', domain: 'ai-director', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await markAiDirectorEventReadHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/ai-director/events/:id/archive', domain: 'ai-director', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await archiveAiDirectorEventHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-director/recommendations', domain: 'ai-director', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiDirectorRecommendationsHandler(context))) });
}
