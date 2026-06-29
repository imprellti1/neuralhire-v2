import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryEvents = [];

function now() { return new Date().toISOString(); }
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'whatsapp-learning' }); }
function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }

function normalizeKey(accountId, whatsappMessageId) {
  return `${String(accountId || '').trim()}::${String(whatsappMessageId || '').trim()}`;
}

function buildRow(data = {}) {
  return {
    id: randomUUID(),
    account_id: data.accountId,
    whatsapp_message_id: data.whatsappMessageId || null,
    message_id: data.messageId || null,
    conversation_id: data.conversationId || null,
    lead_id: data.leadId || null,
    source: data.source || 'whatsapp',
    content_type: data.contentType || 'text',
    body: data.body || null,
    intent: data.intent || null,
    sentiment: data.sentiment || null,
    importance: data.importance ?? null,
    summary: data.summary || null,
    needs_followup: Boolean(data.needsFollowup),
    next_action: data.nextAction || null,
    entities: Array.isArray(data.entities) ? data.entities : [],
    topics: Array.isArray(data.topics) ? data.topics : [],
    metadata: data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {},
    status: data.status || 'pending',
    processed_at: data.processedAt || null,
    error: data.error || null,
    created_at: now(),
    updated_at: now()
  };
}

export function __resetMemoryWhatsappLearningForTests() { memoryEvents.length = 0; }
export function __dumpMemoryWhatsappLearningForTests() { return memoryEvents.map((item) => ({ ...item, entities: [...(item.entities || [])], topics: [...(item.topics || [])], metadata: { ...(item.metadata || {}) } })); }

export async function createLearningEvent(data = {}, options = {}) {
  const accountId = options.accountId || data.accountId || null;
  assertAccountId(accountId);
  const whatsappMessageId = data.whatsappMessageId || null;
  const key = normalizeKey(accountId, whatsappMessageId);
  if (!whatsappMessageId) throw new DatabaseError('whatsappMessageId obrigatorio');

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: existing, error: existingError } = await supabase.from('whatsapp_learning_events').select('*').eq('account_id', accountId).eq('whatsapp_message_id', whatsappMessageId).maybeSingle();
    if (existingError) throw new DatabaseError('Falha ao consultar evento de aprendizagem', { details: existingError });
    if (existing) return { item: existing, status: 'already_exists' };
    const row = buildRow({ ...data, accountId, whatsappMessageId });
    const { data: created, error } = await supabase.from('whatsapp_learning_events').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar evento de aprendizagem', { details: error });
    return { item: created || row, status: 'created' };
  }

  const existing = memoryEvents.find((item) => normalizeKey(item.account_id, item.whatsapp_message_id) === key) || null;
  if (existing) return { item: existing, status: 'already_exists' };
  const row = buildRow({ ...data, accountId, whatsappMessageId });
  memoryEvents.push(row);
  return { item: row, status: 'created' };
}

export async function listPendingLearningEvents({ accountId, limit = 10 } = {}) {
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('whatsapp_learning_events').select('*').eq('account_id', accountId).eq('status', 'pending').order('created_at', { ascending: true }).limit(Math.max(1, Number(limit) || 10));
    if (error) throw new DatabaseError('Falha ao listar eventos de aprendizagem', { details: error });
    return data || [];
  }
  return memoryEvents.filter((item) => item.account_id === accountId && item.status === 'pending').slice(0, Math.max(1, Number(limit) || 10));
}

export async function updateLearningEvent(eventId, patch = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('whatsapp_learning_events').update({ ...patch, updated_at: now() }).eq('id', eventId).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar evento de aprendizagem', { details: error });
    return data;
  }
  const idx = memoryEvents.findIndex((item) => item.id === eventId && item.account_id === accountId);
  if (idx < 0) return null;
  memoryEvents[idx] = { ...memoryEvents[idx], ...patch, updated_at: now() };
  return memoryEvents[idx];
}
