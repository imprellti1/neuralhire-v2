import { analyzeCommercialConversation, getCommercialActionForConversation } from './commercial-agent.repository.js';

export async function analyzeCommercialAgentHandler(context) {
  const conversationId = String(context?.body?.conversationId || context?.params?.conversationId || '').trim();
  return { ok: true, item: await analyzeCommercialConversation(conversationId, { accountId: context.accountId, context }) };
}

export async function getCommercialAgentConversationHandler(context) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  return { ok: true, item: await getCommercialActionForConversation(conversationId, { accountId: context.accountId, context }) };
}
