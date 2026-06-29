import { normalizeAddMessagePayload, normalizeConversationListFilters, normalizeConversationStatus, normalizeCreateConversationPayload, normalizeEventPayload, normalizeStatusPayload } from './whatsapp-conversations.schemas.js';
import { getWhatsappConversationContext } from './whatsapp-context.repository.js';
import { addEvent, addMessage, createConversation, getConversationDetail, getConversationById, getWhatsappConversationsRepositoryMode, listConversations, listConversationsByCliente, listEvents, listMessages, listMessagesByClienteConversation, updateConversationStatus } from './whatsapp-conversations.repository.js';
import { mapConversation, mapEvents, mapMessages } from './whatsapp-conversations.mapper.js';
import { getMessageDraftById, listMessageDraftsByConversation } from '../message-drafts/message-drafts.repository.js';
import { getApprovalByDraftId } from '../message-approvals/message-approvals.repository.js';
import { getWhatsappDeliveryRepositoryMode } from '../whatsapp-delivery/whatsapp-delivery.repository.js';

export async function listWhatsappConversationsHandler(context = {}) {
  const filters = normalizeConversationListFilters(context.query || {});
  const result = await listConversations(filters, { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), items: result.items.map(mapConversation), pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } };
}
export async function getWhatsappConversationHandler(context = {}) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  const item = await getConversationDetail(conversationId, { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), conversation: mapConversation(item.conversation), messages: mapMessages(item.messages), events: mapEvents(item.events) };
}
export async function getConversationContextHandler(context = {}) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  const item = await getWhatsappConversationContext(conversationId, { accountId: context.accountId, context });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), ...item };
}
export async function createWhatsappConversationHandler(context = {}) {
  const item = await createConversation({ ...normalizeCreateConversationPayload(context.body || {}), origin: 'manual' }, { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), item: mapConversation(item) };
}
export async function addWhatsappMessageHandler(context = {}) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  const item = await addMessage(conversationId, normalizeAddMessagePayload(context.body || {}), { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), item };
}
export async function updateWhatsappConversationStatusHandler(context = {}) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  const { status } = normalizeStatusPayload(context.body || {});
  const item = await updateConversationStatus(conversationId, normalizeConversationStatus(status), { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), item: mapConversation(item) };
}
export async function addWhatsappConversationEventHandler(context = {}) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  const item = await addEvent(conversationId, normalizeEventPayload(context.body || {}), { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), item };
}

function pickLatestDraft(drafts = []) {
  return [...drafts].sort((a, b) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')))[0] || null;
}

function deriveDeliveryState(conversation = {}, messages = [], events = []) {
  const latestOutbound = [...messages].filter((item) => item.direction === 'outbound').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
  const deliveryEvent = [...events].reverse().find((item) => ['message_sent', 'draft_sent'].includes(item.type)) || null;
  if (latestOutbound?.status === 'sent' || deliveryEvent?.type === 'message_sent' || deliveryEvent?.type === 'draft_sent') {
    return { status: 'sent', messageId: latestOutbound?.id || null };
  }
  if (latestOutbound?.status === 'failed') return { status: 'failed', messageId: latestOutbound?.id || null };
  if (latestOutbound?.status === 'queued') return { status: 'queued', messageId: latestOutbound?.id || null };
  if (conversation.last_message_at) return { status: 'not_sent', messageId: latestOutbound?.id || null };
  return { status: null, messageId: null };
}

export async function getWhatsappConversationDraftStateHandler(context = {}) {
  const conversationId = String(context?.params?.conversationId || '').trim();
  const conversation = await getConversationById(conversationId, { accountId: context.accountId });
  const detail = await getConversationDetail(conversationId, { accountId: context.accountId });
  const drafts = await listMessageDraftsByConversation(conversationId, { accountId: context.accountId });
  const draft = pickLatestDraft(drafts);
  const approval = draft ? await getApprovalByDraftId(draft.id, { accountId: context.accountId }) : null;
  const delivery = deriveDeliveryState(conversation, detail.messages, detail.events);
  return {
    ok: true,
    repositoryMode: getWhatsappConversationsRepositoryMode(),
    deliveryRepositoryMode: getWhatsappDeliveryRepositoryMode(),
    conversation: mapConversation(conversation),
    draft: draft ? await getMessageDraftById(draft.id, { accountId: context.accountId }) : null,
    approval: approval || { status: null, reviewer: null, comment: null },
    delivery
  };
}

function mapConversationSummary(item = {}) {
  return {
    id: item?.id || null,
    provider: item?.provider || 'evolution',
    instance_name: item?.instance_name || item?.instanceName || null,
    instance_type: item?.instance_type || item?.instanceType || 'operational',
    phone: item?.phone || null,
    contact_name: item?.contact_name || item?.contactName || null,
    last_message_at: item?.last_message_at || null,
    last_message_preview: item?.last_message_preview || item?.lastMessagePreview || null,
    message_count: Number(item?.message_count || item?.messageCount || 0),
    direction_last_message: item?.direction_last_message || item?.directionLastMessage || null,
    created_at: item?.created_at || null,
    updated_at: item?.updated_at || null
  };
}

function mapWhatsappMessage(item = {}) {
  return {
    id: item?.id || null,
    message_id: item?.message_id || item?.external_message_id || null,
    direction: item?.direction || null,
    message_type: item?.message_type || null,
    text: item?.text || item?.body || null,
    media_url: item?.media_url || null,
    sent_at: item?.sent_at || item?.received_at || null,
    raw_payload: item?.raw_payload || item?.metadata || null,
    created_at: item?.created_at || null
  };
}

export async function listClienteWhatsappConversationsHandler(context = {}) {
  const clienteId = String(context?.params?.id || '').trim();
  const conversations = await listConversationsByCliente(clienteId, { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), items: conversations.map(mapConversationSummary) };
}

export async function listClienteWhatsappConversationMessagesHandler(context = {}) {
  const clienteId = String(context?.params?.id || '').trim();
  const conversationId = String(context?.params?.conversationId || '').trim();
  const messages = await listMessagesByClienteConversation(clienteId, conversationId, { accountId: context.accountId });
  return { ok: true, repositoryMode: getWhatsappConversationsRepositoryMode(), items: messages.map(mapWhatsappMessage) };
}
