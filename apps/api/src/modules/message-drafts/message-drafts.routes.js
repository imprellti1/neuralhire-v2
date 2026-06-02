import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { generateMessageDraftHandler, getMessageDraftHandler, listMessageDraftsForConversationHandler } from './message-drafts.controller.js';

export function registerMessageDraftRoutes(router) {
  router.registerRoute({ method: 'POST', path: '/message-drafts/generate', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await generateMessageDraftHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/message-drafts/:draftId', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getMessageDraftHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/message-drafts/conversation/:conversationId', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await listMessageDraftsForConversationHandler(context))) });
}
