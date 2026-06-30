import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryCustomerKnowledge = [];

function now() { return new Date().toISOString(); }
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'customer-knowledge' }); }
function cleanText(value) { return String(value ?? '').trim(); }
function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }

function scopeKey(accountId, phone, remoteJid, knowledgeKey) {
  return [String(accountId || '').trim(), cleanText(phone), cleanText(remoteJid), cleanText(knowledgeKey)].join('::');
}

function buildCustomerKnowledgeRow(data = {}) {
  return {
    id: randomUUID(),
    account_id: data.accountId,
    customer_id: data.customerId || null,
    phone: data.phone || null,
    remote_jid: data.remoteJid || null,
    knowledge_key: cleanText(data.knowledgeKey),
    knowledge_value: data.knowledgeValue ?? null,
    knowledge_type: cleanText(data.knowledgeType || 'general').toLowerCase() || 'general',
    confidence: Number.isFinite(Number(data.confidence)) ? Math.min(1, Math.max(0, Number(data.confidence))) : 0,
    first_seen_at: data.firstSeenAt || now(),
    last_seen_at: data.lastSeenAt || now(),
    occurrences: Math.max(1, Number(data.occurrences) || 1),
    source_events: Array.isArray(data.sourceEvents) ? data.sourceEvents : [],
    metadata: data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {},
    status: data.status || 'active',
    created_at: data.createdAt || now(),
    updated_at: data.updatedAt || now()
  };
}

export function __resetMemoryCustomerKnowledgeForTests() { memoryCustomerKnowledge.length = 0; }
export function __dumpMemoryCustomerKnowledgeForTests() { return memoryCustomerKnowledge.map((item) => ({ ...item, source_events: Array.isArray(item.source_events) ? [...item.source_events] : [], metadata: { ...(item.metadata || {}) } })); }

export async function markCustomerKnowledgeStatus({ accountId, id, status, metadata = {} } = {}) {
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('customer_knowledge').update({ status, metadata, updated_at: now() }).eq('account_id', accountId).eq('id', id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar memoria consolidada', { details: error });
    return data;
  }
  const idx = memoryCustomerKnowledge.findIndex((item) => item.account_id === accountId && item.id === id);
  if (idx < 0) return null;
  memoryCustomerKnowledge[idx] = { ...memoryCustomerKnowledge[idx], status: status || memoryCustomerKnowledge[idx].status, metadata: { ...(memoryCustomerKnowledge[idx].metadata || {}), ...(metadata || {}) }, updated_at: now() };
  return memoryCustomerKnowledge[idx];
}

export async function upsertCustomerKnowledge(data = {}, options = {}) {
  const accountId = options.accountId || data.accountId || null;
  assertAccountId(accountId);
  const row = buildCustomerKnowledgeRow({ ...data, accountId });
  const key = scopeKey(accountId, row.phone, row.remote_jid, row.knowledge_key);

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: existing, error: existingError } = await supabase.from('customer_knowledge').select('*').eq('account_id', accountId).eq('knowledge_key', row.knowledge_key).eq('phone', row.phone).eq('remote_jid', row.remote_jid).maybeSingle();
    if (existingError) throw new DatabaseError('Falha ao consultar memoria consolidada', { details: existingError });
    if (existing) {
      const merged = {
        ...existing,
        knowledge_value: row.knowledge_value ?? existing.knowledge_value,
        knowledge_type: row.knowledge_type || existing.knowledge_type,
        confidence: Math.max(Number(existing.confidence || 0), Number(row.confidence || 0)),
        first_seen_at: existing.first_seen_at || row.first_seen_at,
        last_seen_at: row.last_seen_at || now(),
        occurrences: Number(existing.occurrences || 1) + Number(row.occurrences || 1),
        source_events: [...new Set([...(existing.source_events || []), ...(row.source_events || [])])],
        metadata: { ...(existing.metadata || {}), ...(row.metadata || {}) },
        status: row.status || existing.status
      };
      const { data: updated, error: updateError } = await supabase.from('customer_knowledge').update({ ...merged, updated_at: now() }).eq('id', existing.id).select('*').single();
      if (updateError) throw new DatabaseError('Falha ao atualizar memoria consolidada', { details: updateError });
      return { item: updated, status: 'updated' };
    }
    const { data: created, error } = await supabase.from('customer_knowledge').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar memoria consolidada', { details: error });
    return { item: created || row, status: 'created' };
  }

  const idx = memoryCustomerKnowledge.findIndex((item) => scopeKey(item.account_id, item.phone, item.remote_jid, item.knowledge_key) === key);
  if (idx >= 0) {
    memoryCustomerKnowledge[idx] = {
      ...memoryCustomerKnowledge[idx],
      ...row,
      id: memoryCustomerKnowledge[idx].id,
      first_seen_at: memoryCustomerKnowledge[idx].first_seen_at,
      last_seen_at: row.last_seen_at || now(),
      occurrences: Number(memoryCustomerKnowledge[idx].occurrences || 1) + Number(row.occurrences || 1),
      source_events: [...new Set([...(memoryCustomerKnowledge[idx].source_events || []), ...(row.source_events || [])])],
      metadata: { ...(memoryCustomerKnowledge[idx].metadata || {}), ...(row.metadata || {}) },
      updated_at: now()
    };
    return { item: memoryCustomerKnowledge[idx], status: 'updated' };
  }
  memoryCustomerKnowledge.push(row);
  return { item: row, status: 'created' };
}
