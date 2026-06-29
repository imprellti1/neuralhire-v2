import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const conversations = [];
const messages = [];
const events = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'whatsapp-conversations' });
}

function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }
function normalizePhone(phone) { return String(phone || '').replace(/\D+/g, ''); }
function assertNoForbiddenFields(data = {}) {
  for (const key of Object.keys(data)) {
    if (['account_id', 'accountId', 'tenant_id', 'tenantId', 'owner_user_id', 'ownerUserId'].includes(key)) {
      throw new ValidationError(`Campo nao permitido: ${key}`);
    }
  }
}
function paginate(items, page, limit) { const total = items.length; const from = (page - 1) * limit; return { items: items.slice(from, from + limit), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }; }
function now() { return new Date().toISOString(); }

function filterConversations(items, filters, accountId) {
  return items.filter((item) => item.account_id === accountId)
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.clienteId || item.cliente_id === filters.clienteId)
    .filter((item) => !filters.phone || item.phone === filters.phone)
    .sort((a, b) => String(b.last_message_at || b.created_at || '').localeCompare(String(a.last_message_at || a.created_at || '')));
}

export function getWhatsappConversationsRepositoryMode() { return { mode: mode(), supabaseConfigured: isSupabaseConfigured() }; }

export async function listConversations(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (mode() === 'supabase') throw new DatabaseError('Supabase nao habilitado para lista local nesta etapa');
  return paginate(filterConversations(conversations, filters, accountId), filters.page || 1, filters.limit || 20);
}

export async function getConversationById(conversationId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const item = conversations.find((row) => row.id === conversationId && row.account_id === accountId);
  if (!item) throw new NotFoundError('Conversa nao encontrada', { code: 'WHATSAPP_CONVERSATION_NOT_FOUND', domain: 'whatsapp-conversations' });
  return item;
}

export async function createConversation(data, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  assertNoForbiddenFields(data);
  const phone = normalizePhone(data.phone);
  const clienteId = data.clienteId || null;
  const existing = conversations.find((row) => row.account_id === accountId && row.phone === phone && row.cliente_id === clienteId && row.status === 'open');
  if (existing) return existing;
  const item = { id: randomUUID(), account_id: accountId, cliente_id: clienteId, vendedor_id: data.vendedorId || null, phone, contact_name: data.contactName || null, status: 'open', origin: data.origin || 'manual', channel: 'whatsapp', last_message_at: null, assigned_to: data.vendedorId || null, metadata: {}, created_at: now(), updated_at: now() };
  conversations.push(item);
  await addEvent(item.id, { type: 'conversation_created', payload: { phone, cliente_id: clienteId } }, options);
  return item;
}

export async function addMessage(conversationId, data, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const conversation = await getConversationById(conversationId, options);
  const item = { id: randomUUID(), account_id: accountId, conversation_id: conversation.id, cliente_id: conversation.cliente_id, direction: data.direction, sender_type: data.senderType, sender_id: data.senderId || null, phone: conversation.phone, body: data.body, message_type: data.messageType || 'text', external_message_id: null, status: data.status || 'draft', metadata: {}, sent_at: null, received_at: null, created_at: now() };
  if (item.direction === 'outbound' && item.status === 'sent') item.sent_at = now();
  if (item.direction === 'inbound' && item.status === 'received') item.received_at = now();
  messages.push(item);
  conversation.last_message_at = item.created_at;
  conversation.updated_at = now();
  await addEvent(conversationId, { type: 'message_created', payload: { message_id: item.id, status: item.status } }, options);
  return item;
}

export async function updateConversationStatus(conversationId, status, options = {}) {
  const conversation = await getConversationById(conversationId, options);
  conversation.status = status;
  conversation.updated_at = now();
  await addEvent(conversationId, { type: 'status_changed', payload: { status } }, options);
  return conversation;
}

export async function addEvent(conversationId, data, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  await getConversationById(conversationId, options);
  const item = { id: randomUUID(), account_id: accountId, conversation_id: conversationId, type: data.type, payload: data.payload || {}, created_by: options.createdBy || null, created_at: now() };
  events.push(item);
  return item;
}

export async function listMessages(conversationId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  await getConversationById(conversationId, options);
  return messages.filter((item) => item.account_id === accountId && item.conversation_id === conversationId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export async function listConversationsByCliente(clienteId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const normalizedClienteId = String(clienteId || '').trim();
  if (!normalizedClienteId) throw new ValidationError('Parametro clienteId obrigatorio', { code: 'VALIDATION_ERROR', domain: 'whatsapp-conversations' });
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('account_id', accountId)
      .eq('cliente_id', normalizedClienteId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false });
    if (error) throw new DatabaseError(error.message || 'Falha ao listar conversas WhatsApp');
    return data || [];
  }
  return conversations
    .filter((item) => item.account_id === accountId && String(item.cliente_id || '') === normalizedClienteId)
    .sort((a, b) => String(b.last_message_at || b.created_at || '').localeCompare(String(a.last_message_at || a.created_at || '')));
}

export async function listMessagesByClienteConversation(clienteId, conversationId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const normalizedClienteId = String(clienteId || '').trim();
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedClienteId) throw new ValidationError('Parametro clienteId obrigatorio', { code: 'VALIDATION_ERROR', domain: 'whatsapp-conversations' });
  if (!normalizedConversationId) throw new ValidationError('Parametro conversationId obrigatorio', { code: 'VALIDATION_ERROR', domain: 'whatsapp-conversations' });
  const conversation = await getConversationById(normalizedConversationId, options);
  if (String(conversation.cliente_id || '') !== normalizedClienteId) {
    throw new NotFoundError('Conversa nao encontrada', { code: 'WHATSAPP_CONVERSATION_NOT_FOUND', domain: 'whatsapp-conversations' });
  }
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('account_id', accountId)
      .eq('cliente_id', normalizedClienteId)
      .eq('conversation_id', normalizedConversationId)
      .order('created_at', { ascending: true, nullsFirst: false });
    if (error) throw new DatabaseError(error.message || 'Falha ao listar mensagens WhatsApp');
    return data || [];
  }
  return messages
    .filter((item) => item.account_id === accountId && item.conversation_id === normalizedConversationId && String(item.cliente_id || '') === normalizedClienteId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export async function listEvents(conversationId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  await getConversationById(conversationId, options);
  return events.filter((item) => item.account_id === accountId && item.conversation_id === conversationId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export async function getConversationDetail(conversationId, options = {}) {
  const conversation = await getConversationById(conversationId, options);
  return { conversation, messages: await listMessages(conversationId, options), events: await listEvents(conversationId, options) };
}

export function __resetMemoryWhatsappConversationsForTests() { conversations.length = 0; messages.length = 0; events.length = 0; }
