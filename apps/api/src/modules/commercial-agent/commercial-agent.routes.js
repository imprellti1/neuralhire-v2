import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { analyzeCommercialAgentHandler, getCommercialAgentConversationHandler } from './commercial-agent.controller.js';

export function registerCommercialAgentRoutes(router) {
  router.registerRoute({ method: 'POST', path: '/commercial-agent/analyze', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await analyzeCommercialAgentHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/commercial-agent/conversation/:conversationId', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getCommercialAgentConversationHandler(context))) });
}
