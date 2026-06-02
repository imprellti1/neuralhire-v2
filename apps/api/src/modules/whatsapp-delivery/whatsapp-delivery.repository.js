import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import { isSupabaseConfigured } from '../../database/supabase.client.js';
import { addEvent, addMessage, getConversationById } from '../whatsapp-conversations/whatsapp-conversations.repository.js';
import { getMessageDraftById } from '../message-drafts/message-drafts.repository.js';
import { normalizePhone, sendTextMessage } from './whatsapp-delivery.evolution.js';

const logs = [];

function now() { return new Date().toISOString(); }
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'whatsapp-delivery' }); }

export function getWhatsappDeliveryRepositoryMode() { return { mode: isSupabaseConfigured() ? 'supabase' : 'memory', supabaseConfigured: isSupabaseConfigured() }; }

export async function sendApprovedDraft(draftId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const draft = await getMessageDraftById(draftId, { accountId });
  if (draft.status !== 'approved') return { ok: false, code: 'DRAFT_NOT_APPROVED' };
  if (!draft.conversation_id) throw new NotFoundError('Conversa nao encontrada', { code: 'WHATSAPP_CONVERSATION_NOT_FOUND', domain: 'whatsapp-delivery' });
  const conversation = await getConversationById(draft.conversation_id, { accountId });
  if (!conversation.phone) return { ok: false, code: 'PHONE_REQUIRED' };
  const phone = normalizePhone(conversation.phone);
  const response = await sendTextMessage({
    phone,
    message: draft.draft_text,
    apiUrl: process.env.EVOLUTION_API_URL,
    apiKey: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_INSTANCE
  });
  const log = { id: randomUUID(), account_id: accountId, conversation_id: conversation.id, draft_id: draft.id, phone, status: response.ok ? 'sent' : 'failed', request_payload: { draftId }, response_payload: response, error_message: response.ok ? null : response.code, created_by: options.createdBy || null, created_at: now() };
  logs.push(log);
  if (!response.ok) return { ok: false, code: response.code || 'EVOLUTION_FAILED' };
  const message = await addMessage(conversation.id, { direction: 'outbound', body: draft.draft_text, senderType: 'seller', status: 'sent' }, { accountId });
  await addEvent(conversation.id, { type: 'message_sent', payload: { draft_id: draft.id, message_id: message.id, external_message_id: response.externalMessageId } }, { accountId, createdBy: options.createdBy || null });
  await addEvent(conversation.id, { type: 'draft_sent', payload: { draft_id: draft.id } }, { accountId, createdBy: options.createdBy || null });
  return { ok: true, draftId: draft.id, conversationId: conversation.id, externalMessageId: response.externalMessageId, status: 'sent', messageId: message.id, logId: log.id };
}

export async function registerWebhookEvent(payload = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const item = { id: randomUUID(), account_id: accountId, type: 'webhook', payload, created_at: now() };
  logs.push(item);
  return { ok: true };
}

export function __resetMemoryWhatsappDeliveryForTests() { logs.length = 0; }
