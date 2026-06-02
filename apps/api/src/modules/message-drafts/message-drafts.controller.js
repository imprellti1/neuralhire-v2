import { getCustomerMemory } from '../customer-memory/customer-memory.repository.js';
import { addEvent, getConversationById } from '../whatsapp-conversations/whatsapp-conversations.repository.js';
import { analyzeCommercialConversation, getCommercialActionForConversation } from '../commercial-agent/commercial-agent.repository.js';
import { generateDraft } from './message-drafts.engine.js';
import { getMessageDraftById, listMessageDraftsByConversation, saveMessageDraft } from './message-drafts.repository.js';

export async function generateMessageDraftHandler(context = {}) {
  const conversationId = String(context?.body?.conversationId || context?.params?.conversationId || '').trim();
  const conversation = await getConversationById(conversationId, { accountId: context.accountId });
  const customerMemory = conversation.cliente_id ? await getCustomerMemory(conversation.cliente_id, { accountId: context.accountId }) : {};
  let action = null;
  try {
    action = await getCommercialActionForConversation(conversationId, { accountId: context.accountId });
  } catch (error) {
    if (error?.code === 'COMMERCIAL_AGENT_NOT_FOUND') action = await analyzeCommercialConversation(conversationId, { accountId: context.accountId });
    else throw error;
  }
  const draft = generateDraft({
    action,
    customerMemory,
    opportunities: customerMemory.opportunities || [],
    alerts: customerMemory.alerts || [],
    conversationSummary: context.body?.conversationSummary || {},
    conversationStatus: conversation.status
  });
  const saved = await saveMessageDraft({
    conversationId,
    clienteId: conversation.cliente_id || null,
    customerMemoryId: customerMemory?.id || null,
    draftType: draft.draftType,
    status: 'generated',
    confidenceScore: draft.confidenceScore,
    reason: draft.reason,
    context: draft.context,
    draftText: draft.draftText,
    actionId: draft.action?.id || action?.id || null,
    actionType: draft.action?.type || action?.action_type || null,
    actionConfidence: draft.action?.confidence ?? action?.confidence_score ?? null,
    actionReason: draft.action?.reason || action?.reason || null
  }, { accountId: context.accountId });
  if (conversation.id) {
    await addEvent(conversation.id, { type: 'draft_generated', payload: { draft_id: saved.id, draft_type: saved.draft_type, confidence: saved.confidence_score } }, { accountId: context.accountId });
  }
  return { ok: true, draftId: saved.id, draftType: saved.draft_type, confidence: saved.confidence_score, reason: saved.reason, draft: saved.draft_text, action: { id: saved.action_id, type: saved.action_type, confidence: saved.action_confidence, reason: saved.action_reason }, context: saved.context };
}

export async function getMessageDraftHandler(context = {}) {
  const draftId = String(context?.params?.draftId || '').trim();
  return getMessageDraftById(draftId, { accountId: context.accountId });
}

export async function listMessageDraftsForConversationHandler(context = {}) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  return listMessageDraftsByConversation(conversationId, { accountId: context.accountId });
}
