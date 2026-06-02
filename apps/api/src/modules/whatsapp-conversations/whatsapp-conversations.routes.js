import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { addWhatsappConversationEventHandler, addWhatsappMessageHandler, createWhatsappConversationHandler, getConversationContextHandler, getWhatsappConversationDraftStateHandler, getWhatsappConversationHandler, listWhatsappConversationsHandler, updateWhatsappConversationStatusHandler } from './whatsapp-conversations.controller.js';
import { whatsappConversationsModule } from './whatsapp-conversations.module.js';
import { normalizeAddMessagePayload, normalizeConversationListFilters, normalizeCreateConversationPayload, normalizeEventPayload, normalizeStatusPayload } from './whatsapp-conversations.schemas.js';

export function registerWhatsappConversationsRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/whatsapp/conversations', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await listWhatsappConversationsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/whatsapp/conversations/:conversationId', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getWhatsappConversationHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/whatsapp/conversations/:conversationId/context', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getConversationContextHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/whatsapp/conversations/:conversationId/draft-state', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getWhatsappConversationDraftStateHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/whatsapp/conversations', domain: 'whatsapp', schema: normalizeCreateConversationPayload, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await createWhatsappConversationHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/whatsapp/conversations/:conversationId/messages', domain: 'whatsapp', schema: normalizeAddMessagePayload, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await addWhatsappMessageHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/whatsapp/conversations/:conversationId/status', domain: 'whatsapp', schema: normalizeStatusPayload, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await updateWhatsappConversationStatusHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/whatsapp/conversations/:conversationId/events', domain: 'whatsapp', schema: normalizeEventPayload, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await addWhatsappConversationEventHandler(context))) });
}
