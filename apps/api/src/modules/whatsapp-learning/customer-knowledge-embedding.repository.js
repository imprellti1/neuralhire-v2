import { createHash, randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryEmbeddings = [];

function now() { return new Date().toISOString(); }
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'customer-knowledge-embedding' }); }
function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }
function cleanText(value) { return String(value ?? '').trim(); }

function scopeKey(accountId, customerKnowledgeId) {
  return [String(accountId || '').trim(), String(customerKnowledgeId || '').trim()].join('::');
}

export function buildEmbeddingHash(knowledgeValue, version) {
  return createHash('sha256').update(`${cleanText(knowledgeValue)}${String(Number(version) || 0)}`).digest('hex');
}

function buildEmbeddingRow(data = {}) {
  const metadata = data.embeddingMetadata && typeof data.embeddingMetadata === 'object' && !Array.isArray(data.embeddingMetadata) ? data.embeddingMetadata : {};
  return {
    id: randomUUID(),
    account_id: data.accountId,
    customer_knowledge_id: data.customerKnowledgeId || null,
    embedding_provider: cleanText(data.embeddingProvider || 'disabled').toLowerCase() || 'disabled',
    embedding_model: data.embeddingModel || null,
    embedding_dimensions: Number.isFinite(Number(data.embeddingDimensions)) ? Math.max(0, Number(data.embeddingDimensions)) : 0,
    embedding_status: data.embeddingStatus || 'pending',
    embedding_version: Math.max(1, Number(data.embeddingVersion) || 1),
    embedding_hash: data.embeddingHash || null,
    embedding_metadata: metadata,
    last_attempt_at: data.lastAttemptAt || null,
    processed_at: data.processedAt || null,
    error_message: data.errorMessage || null,
    created_at: data.createdAt || now(),
    updated_at: data.updatedAt || now()
  };
}

export function __resetMemoryCustomerKnowledgeEmbeddingsForTests() {
  memoryEmbeddings.length = 0;
}

export function __dumpMemoryCustomerKnowledgeEmbeddingsForTests() {
  return memoryEmbeddings.map((item) => ({ ...item, embedding_metadata: { ...(item.embedding_metadata || {}) } }));
}

async function queryExistingEmbedding(accountId, customerKnowledgeId) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('customer_knowledge_embeddings')
      .select('*')
      .eq('account_id', accountId)
      .eq('customer_knowledge_id', customerKnowledgeId)
      .maybeSingle();
    if (error) throw new DatabaseError('Falha ao consultar embedding de memoria', { details: error });
    return data || null;
  }
  return memoryEmbeddings.find((item) => item.account_id === accountId && item.customer_knowledge_id === customerKnowledgeId) || null;
}

export async function upsertEmbedding(data = {}, options = {}) {
  const accountId = options.accountId || data.accountId || null;
  assertAccountId(accountId);
  const row = buildEmbeddingRow({ ...data, accountId });
  const existing = await queryExistingEmbedding(accountId, row.customer_knowledge_id);

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    if (existing) {
      const merged = {
        ...existing,
        ...row,
        id: existing.id,
        created_at: existing.created_at || row.created_at,
        updated_at: now()
      };
      const { data: updated, error } = await supabase.from('customer_knowledge_embeddings').update(merged).eq('id', existing.id).eq('account_id', accountId).select('*').single();
      if (error) throw new DatabaseError('Falha ao atualizar embedding de memoria', { details: error });
      return { item: updated, status: 'updated' };
    }
    const { data: created, error } = await supabase.from('customer_knowledge_embeddings').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar embedding de memoria', { details: error });
    return { item: created || row, status: 'created' };
  }

  const idx = memoryEmbeddings.findIndex((item) => scopeKey(item.account_id, item.customer_knowledge_id) === scopeKey(accountId, row.customer_knowledge_id));
  if (idx >= 0) {
    memoryEmbeddings[idx] = { ...memoryEmbeddings[idx], ...row, id: memoryEmbeddings[idx].id, created_at: memoryEmbeddings[idx].created_at, updated_at: now() };
    return { item: memoryEmbeddings[idx], status: 'updated' };
  }
  memoryEmbeddings.push(row);
  return { item: row, status: 'created' };
}

export async function createPendingEmbedding(data = {}, options = {}) {
  const accountId = options.accountId || data.accountId || null;
  const row = {
    ...data,
    accountId,
    embeddingStatus: 'pending',
    lastAttemptAt: null,
    processedAt: null,
    errorMessage: null
  };
  return upsertEmbedding(row, { accountId });
}

export async function findPendingEmbeddings({ accountId, limit = 100 } = {}) {
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('customer_knowledge_embeddings')
      .select('*')
      .eq('account_id', accountId)
      .eq('embedding_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(Math.max(1, Number(limit) || 100));
    if (error) throw new DatabaseError('Falha ao listar embeddings pendentes', { details: error });
    return data || [];
  }
  return memoryEmbeddings.filter((item) => item.account_id === accountId && item.embedding_status === 'pending').slice(0, Math.max(1, Number(limit) || 100));
}

export async function markEmbeddingProcessing({ accountId, id, embeddingMetadata = {}, embeddingProvider = null, embeddingModel = null } = {}) {
  assertAccountId(accountId);
  const patch = {
    embedding_status: 'processing',
    last_attempt_at: now(),
    error_message: null,
    embedding_metadata: embeddingMetadata,
    embedding_provider: embeddingProvider,
    embedding_model: embeddingModel,
    updated_at: now()
  };
  return updateEmbeddingById({ accountId, id, patch, status: 'processing' });
}

export async function markEmbeddingProcessed({ accountId, id, embeddingMetadata = {}, embeddingProvider = null, embeddingModel = null, embeddingDimensions = 0 } = {}) {
  assertAccountId(accountId);
  const patch = {
    embedding_status: 'processed',
    processed_at: now(),
    last_attempt_at: now(),
    error_message: null,
    embedding_metadata: embeddingMetadata,
    embedding_provider: embeddingProvider,
    embedding_model: embeddingModel,
    embedding_dimensions: Math.max(0, Number(embeddingDimensions) || 0),
    updated_at: now()
  };
  return updateEmbeddingById({ accountId, id, patch, status: 'processed' });
}

export async function markEmbeddingFailed({ accountId, id, errorMessage, embeddingMetadata = {} } = {}) {
  assertAccountId(accountId);
  const patch = {
    embedding_status: 'failed',
    processed_at: null,
    last_attempt_at: now(),
    error_message: cleanText(errorMessage) || null,
    embedding_metadata: embeddingMetadata,
    updated_at: now()
  };
  return updateEmbeddingById({ accountId, id, patch, status: 'failed' });
}

async function updateEmbeddingById({ accountId, id, patch, status } = {}) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('customer_knowledge_embeddings').update(patch).eq('account_id', accountId).eq('id', id).select('*').single();
    if (error) throw new DatabaseError(`Falha ao marcar embedding como ${status}`, { details: error });
    return data;
  }
  const idx = memoryEmbeddings.findIndex((item) => item.account_id === accountId && item.id === id);
  if (idx < 0) return null;
  memoryEmbeddings[idx] = { ...memoryEmbeddings[idx], ...patch };
  return memoryEmbeddings[idx];
}
