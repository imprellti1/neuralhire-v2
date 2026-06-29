import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../../database/supabase.client.js';
import { getClientesRepositoryMode, __dumpMemoryClientes } from '../../clientes/clientes.repository.js';
import { registrarEventoTimeline } from '../../clientes/clientes.timeline.service.js';

const memoryMessages = [];
const memoryConversations = [];
const memoryLeads = [];
const memoryInstances = [];
const memoryMessageLinks = new Map();

function now() { return new Date().toISOString(); }

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'whatsapp-evolution' });
}

function normalizeProvider(provider = 'evolution') {
  return String(provider || 'evolution').trim() || 'evolution';
}

export function normalizeInstanceType(instanceType = 'operational') {
  const normalized = String(instanceType || 'operational').trim().toLowerCase();
  return normalized === 'learning' ? 'learning' : 'operational';
}

function normalizeDigits(value = '') {
  return String(value || '').replace(/[^0-9]/g, '');
}

function stripWhatsAppSuffix(value = '') {
  return String(value || '').replace(/@(s\.whatsapp\.net|c\.us|g\.us)$/i, '');
}

export function normalizeWhatsAppPhoneVariants(input = {}) {
  const raw = stripWhatsAppSuffix(input.remote_jid || input.phone || input.telefone || input.celular || input.whatsapp || '');
  const digits = normalizeDigits(raw);
  const without55 = digits.startsWith('55') ? digits.slice(2) : digits;
  const with55 = digits.startsWith('55') ? digits : `55${digits}`;
  const tail11 = digits.slice(-11);
  const tail10 = digits.slice(-10);
  const tail9 = digits.slice(-9);
  const tail8 = digits.slice(-8);
  return {
    raw,
    digits,
    without55,
    with55,
    tail11,
    tail10,
    tail9,
    tail8,
    variants: [...new Set([digits, without55, with55, tail11, tail10, tail9, tail8].filter(Boolean))]
  };
}

function pickPhoneValue(cliente = {}) {
  return cliente.telefone || cliente.celular || cliente.whatsapp || cliente.documento || '';
}

function comparePhoneScore(phoneVariants, clientePhoneVariants) {
  const clientDigits = clientePhoneVariants.digits;
  if (!clientDigits) return null;
  if (phoneVariants.digits && clientDigits === phoneVariants.digits) return { strength: 'strong', matched: clientDigits };
  if (phoneVariants.without55 && clientDigits === phoneVariants.without55) return { strength: 'medium', matched: clientDigits };
  if (phoneVariants.with55 && clientDigits === phoneVariants.with55) return { strength: 'medium', matched: clientDigits };
  if (phoneVariants.tail11 && clientDigits.endsWith(phoneVariants.tail11)) return { strength: 'weak', matched: phoneVariants.tail11 };
  if (phoneVariants.tail10 && clientDigits.endsWith(phoneVariants.tail10)) return { strength: 'weak', matched: phoneVariants.tail10 };
  if (phoneVariants.tail9 && clientDigits.endsWith(phoneVariants.tail9)) return { strength: 'weak', matched: phoneVariants.tail9 };
  if (phoneVariants.tail8 && clientDigits.endsWith(phoneVariants.tail8)) return { strength: 'weak', matched: phoneVariants.tail8 };
  return null;
}

function buildClientePhoneVariants(cliente = {}) {
  const phone = pickPhoneValue(cliente);
  const variants = normalizeWhatsAppPhoneVariants({ phone });
  return variants;
}

function makeConversationKey(accountId, instanceId, remoteJid) {
  return `${accountId || ''}::${instanceId || ''}::${remoteJid || ''}`;
}

function memoryFindConversation(accountId, instanceId, remoteJid) {
  return memoryConversations.find((item) => item.account_id === accountId && String(item.instance_id || '') === String(instanceId || '') && item.remote_jid === remoteJid) || null;
}

function memoryFindLead(accountId, instanceId, remoteJid) {
  return memoryLeads.find((item) => item.account_id === accountId && String(item.instance_id || '') === String(instanceId || '') && item.remote_jid === remoteJid) || null;
}

function memoryFindMessage(accountId, provider, messageId) {
  return memoryMessages.find((item) => item.account_id === accountId && item.provider === provider && item.message_id === messageId) || null;
}

function patchMemoryMessage(messageId, accountId, patch) {
  const idx = memoryMessages.findIndex((item) => item.id === messageId && item.account_id === accountId);
  if (idx < 0) return null;
  memoryMessages[idx] = { ...memoryMessages[idx], ...patch, updated_at: now() };
  return memoryMessages[idx];
}

function patchMemoryConversation(id, accountId, patch) {
  const idx = memoryConversations.findIndex((item) => item.id === id && item.account_id === accountId);
  if (idx < 0) return null;
  memoryConversations[idx] = { ...memoryConversations[idx], ...patch, updated_at: now() };
  return memoryConversations[idx];
}

function patchMemoryLead(id, accountId, patch) {
  const idx = memoryLeads.findIndex((item) => item.id === id && item.account_id === accountId);
  if (idx < 0) return null;
  memoryLeads[idx] = { ...memoryLeads[idx], ...patch, updated_at: now() };
  return memoryLeads[idx];
}

function buildMessageRow(payload, context = {}) {
  return {
    id: randomUUID(),
    account_id: context.accountId,
    instance_id: payload.instanceId || null,
    conversation_id: payload.conversationId || null,
    cliente_id: payload.clienteId || null,
    lead_id: payload.leadId || null,
    provider: normalizeProvider(payload.provider),
    event_type: payload.eventType || null,
    message_id: payload.messageId,
    remote_jid: payload.remoteJid,
    phone_normalized: payload.phoneNormalized || null,
    direction: payload.direction,
    sender_type: payload.senderType,
    message_type: payload.messageType || null,
    body: payload.body || null,
    metadata: payload.metadata || {},
    raw_payload: payload.rawPayload || {},
    sent_at: payload.sentAt || null,
    received_at: payload.receivedAt || now(),
    created_at: now(),
    updated_at: now()
  };
}

function buildConversationRow(payload, context = {}) {
  return {
    id: randomUUID(),
    account_id: context.accountId,
    instance_id: payload.instanceId || null,
    cliente_id: payload.clienteId || null,
    lead_id: payload.leadId || null,
    remote_jid: payload.remoteJid,
    phone_normalized: payload.phoneNormalized || null,
    contact_name: payload.contactName || null,
    status: 'open',
    last_message_at: payload.lastMessageAt || now(),
    metadata: payload.metadata || {},
    created_at: now(),
    updated_at: now()
  };
}

function buildLeadRow(payload, context = {}) {
  return {
    id: randomUUID(),
    account_id: context.accountId,
    instance_id: payload.instanceId || null,
    remote_jid: payload.remoteJid,
    phone_normalized: payload.phoneNormalized || null,
    name: payload.contactName || null,
    status: 'pending',
    cliente_id: null,
    first_message_at: payload.firstMessageAt || now(),
    last_message_at: payload.lastMessageAt || now(),
    metadata: payload.metadata || {},
    created_at: now(),
    updated_at: now()
  };
}

export function __resetMemoryEvolutionForTests() {
  memoryMessages.length = 0;
  memoryConversations.length = 0;
  memoryLeads.length = 0;
  memoryInstances.length = 0;
  memoryMessageLinks.clear();
}

export function __loadMemoryEvolutionForTests(snapshot = {}) {
  __resetMemoryEvolutionForTests();
  for (const item of snapshot.messages || []) memoryMessages.push({ ...item });
  for (const item of snapshot.conversations || []) memoryConversations.push({ ...item });
  for (const item of snapshot.leads || []) memoryLeads.push({ ...item });
  for (const item of snapshot.instances || []) memoryInstances.push({ ...item });
}

export async function findWhatsappInstanceByName({ provider = 'evolution', instanceName, instanceType = null }, options = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedName = String(instanceName || '').trim();
  const normalizedType = instanceType ? normalizeInstanceType(instanceType) : null;
  if (!normalizedName) return null;

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('provider', normalizedProvider)
      .eq('instance_name', normalizedName)
      .limit(10);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao buscar instancia WhatsApp', { details: error });
    const items = data || [];
    return items.find((item) => !normalizedType || normalizeInstanceType(item.instance_type) === normalizedType) || items[0] || null;
  }

  const items = memoryInstances.filter((item) => normalizeProvider(item.provider) === normalizedProvider && String(item.instance_name || '').trim() === normalizedName);
  return items.find((item) => !normalizedType || normalizeInstanceType(item.instance_type) === normalizedType) || items[0] || null;
}

export async function findMessageByLogicalKey({ accountId, provider = 'evolution', messageId }) {
  const normalizedProvider = normalizeProvider(provider);
  const inMemory = memoryFindMessage(accountId, normalizedProvider, messageId);
  if (inMemory) return inMemory;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from('whatsapp_messages').select('*').eq('account_id', accountId).eq('provider', normalizedProvider).eq('message_id', messageId).maybeSingle();
  return data || null;
}

export async function findCustomerByPhone(accountId, phoneNormalized) {
  assertAccountId(accountId);
  const variants = normalizeWhatsAppPhoneVariants({ phone: phoneNormalized });
  let items = [];
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('clientes').select('*').eq('account_id', accountId).limit(500);
    if (error) throw new DatabaseError('Falha ao buscar clientes por telefone', { details: error });
    items = data || [];
  } else {
    items = __dumpMemoryClientes().filter((item) => item.account_id === accountId);
  }
  const candidates = [];
  for (const cliente of items) {
    const score = comparePhoneScore(variants, buildClientePhoneVariants(cliente));
    if (score) candidates.push({ cliente, match_strength: score.strength, matched: score.matched });
  }
  if (!candidates.length) return { cliente: null, candidates: [], matchStrength: null };
  candidates.sort((a, b) => ({ strong: 3, medium: 2, weak: 1 }[b.match_strength] - { strong: 3, medium: 2, weak: 1 }[a.match_strength]));
  const strongest = candidates[0];
  const strongestWeight = { strong: 3, medium: 2, weak: 1 }[strongest.match_strength];
  const equallyStrong = candidates.filter((item) => ({ strong: 3, medium: 2, weak: 1 }[item.match_strength]) === strongestWeight);
  if (equallyStrong.length > 1) return { cliente: null, candidates: equallyStrong.map((item) => item.cliente), matchStrength: 'ambiguous' };
  return { cliente: strongest.cliente, candidates: [strongest.cliente], matchStrength: strongest.match_strength };
}

export async function findOrCreateLead({ accountId, instanceId, remoteJid, phoneNormalized, contactName, metadata = {}, firstMessageAt = null, lastMessageAt = null }) {
  assertAccountId(accountId);
  const existing = memoryFindLead(accountId, instanceId, remoteJid);
  if (existing) {
    return patchMemoryLead(existing.id, accountId, {
      phone_normalized: phoneNormalized || existing.phone_normalized || null,
      name: contactName || existing.name || null,
      last_message_at: lastMessageAt || now(),
      metadata: { ...(existing.metadata || {}), ...(metadata || {}) }
    });
  }
  const item = buildLeadRow({ instanceId, remoteJid, phoneNormalized, contactName, metadata, firstMessageAt, lastMessageAt }, { accountId });
  memoryLeads.push(item);
  return item;
}

export async function findOrCreateConversation({ accountId, instanceId, clienteId = null, leadId = null, remoteJid, phoneNormalized, contactName, lastMessageAt = null, metadata = {} }) {
  assertAccountId(accountId);
  const existing = memoryFindConversation(accountId, instanceId, remoteJid);
  if (existing) {
    return patchMemoryConversation(existing.id, accountId, {
      cliente_id: clienteId ?? existing.cliente_id ?? null,
      lead_id: leadId ?? existing.lead_id ?? null,
      phone_normalized: phoneNormalized || existing.phone_normalized || null,
      contact_name: contactName || existing.contact_name || null,
      last_message_at: lastMessageAt || now(),
      status: 'open',
      metadata: { ...(existing.metadata || {}), ...(metadata || {}) }
    });
  }
  const item = buildConversationRow({ instanceId, clienteId, leadId, remoteJid, phoneNormalized, contactName, lastMessageAt, metadata }, { accountId });
  memoryConversations.push(item);
  return item;
}

export async function attachMessageToConversation({ messageId, conversationId, clienteId = null, leadId = null }, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = memoryFindMessage(accountId, 'evolution', messageId) || memoryFindMessage(accountId, normalizeProvider(options.provider || 'evolution'), messageId);
  if (!current) return null;
  const updated = patchMemoryMessage(current.id, accountId, { conversation_id: conversationId, cliente_id: clienteId ?? current.cliente_id ?? null, lead_id: leadId ?? current.lead_id ?? null });
  memoryMessageLinks.set(`${accountId}:${messageId}`, { conversationId, clienteId, leadId });
  return updated;
}

export async function upsertWhatsappMessage(payload, context = {}) {
  const existing = await findMessageByLogicalKey({ accountId: context.accountId, provider: payload.provider, messageId: payload.messageId });
  if (existing) {
    const alreadyLinked = Boolean(existing.conversation_id || existing.cliente_id || existing.lead_id);
    return { status: 'already_exists', item: existing, needsLinking: !alreadyLinked };
  }

  const row = buildMessageRow(payload, context);
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('whatsapp_messages').insert(row).select('*').single();
    if (error) throw error;
    return { status: 'created', item: data, needsLinking: true };
  }

  memoryMessages.push(row);
  return { status: 'created', item: row, needsLinking: true };
}

export async function linkMessageAfterSave(message, link, context = {}) {
  const accountId = context.accountId || null;
  const provider = normalizeProvider(message.provider || 'evolution');
  const messageId = message.message_id || message.messageId;
  assertAccountId(accountId);

  const existing = await findMessageByLogicalKey({ accountId, provider, messageId });
  const currentMessage = existing || message;
  const nextPayload = {
    conversationId: link.conversationId || currentMessage.conversation_id || null,
    clienteId: link.clienteId ?? currentMessage.cliente_id ?? null,
    leadId: link.leadId ?? currentMessage.lead_id ?? null
  };

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('whatsapp_messages').update({
      conversation_id: nextPayload.conversationId,
      cliente_id: nextPayload.clienteId,
      lead_id: nextPayload.leadId,
      phone_normalized: link.phoneNormalized || currentMessage.phone_normalized || null,
      updated_at: now()
    }).eq('account_id', accountId).eq('provider', provider).eq('message_id', messageId).select('*').maybeSingle();
    if (error) throw error;
    return data || currentMessage;
  }

  return patchMemoryMessage(currentMessage.id, accountId, {
    conversation_id: nextPayload.conversationId,
    cliente_id: nextPayload.clienteId,
    lead_id: nextPayload.leadId,
    phone_normalized: link.phoneNormalized || currentMessage.phone_normalized || null
  });
}

export function __dumpMemoryEvolution() {
  return { messages: memoryMessages.map((item) => ({ ...item })), conversations: memoryConversations.map((item) => ({ ...item })), leads: memoryLeads.map((item) => ({ ...item })), instances: memoryInstances.map((item) => ({ ...item })) };
}

export function getEvolutionRepositoryStatus() {
  return { supabaseConfigured: isSupabaseConfigured(), memorySize: memoryMessages.length, conversationSize: memoryConversations.length, leadSize: memoryLeads.length };
}

export async function createTimelineEventForCustomer(clienteId, payload = {}, options = {}) {
  if (!clienteId) return null;
  try {
    return await registrarEventoTimeline({
      tipo: payload.tipo,
      categoria: payload.categoria || 'whatsapp',
      titulo: payload.titulo || 'Mensagem WhatsApp',
      descricao: payload.descricao || '',
      referencia_id: payload.referencia_id || null,
      metadata: payload.metadata || {},
      created_at: payload.created_at || now()
    }, { accountId: options.accountId, clienteId });
  } catch (error) {
    return { ok: false, error };
  }
}
