import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { normalizeCreateObservationPayload, normalizeUpdateObservationPayload, validateObservationPayload } from './ai-director-observations.schemas.js';

const store = [];

function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-observations' }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function normalizeFilters(filters = {}) {
  return {
    manager_id: filters.manager_id ? String(filters.manager_id).trim() : null,
    category: filters.category ? String(filters.category).trim() : null,
    severity: filters.severity ? String(filters.severity).trim() : null,
    status: filters.status ? String(filters.status).trim() : null,
    limit: Number(filters.limit ?? 20),
    offset: Number(filters.offset ?? 0)
  };
}

function sortRows(items = []) {
  return [...items].sort((a, b) => {
    const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    const aScore = severityWeight[String(a.severity).toLowerCase()] || 0;
    const bScore = severityWeight[String(b.severity).toLowerCase()] || 0;
    if (aScore !== bScore) return bScore - aScore;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function applyFilters(items, filters) {
  return items.filter((row) => {
    if (filters.manager_id && row.manager_id !== filters.manager_id) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.severity && row.severity !== filters.severity) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });
}

function shape(row) { return row ? clone(row) : null; }

export async function listObservations(context = {}, filters = {}) {
  const accountId = context?.accountId || null;
  assertAccountId(accountId);
  const normalized = normalizeFilters(filters);
  const limit = Number.isFinite(normalized.limit) && normalized.limit > 0 ? Math.min(Math.floor(normalized.limit), 100) : 20;
  const offset = Number.isFinite(normalized.offset) && normalized.offset >= 0 ? Math.floor(normalized.offset) : 0;
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('ai_director_observations').select('*', { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    for (const [key, value] of Object.entries(normalized)) {
      if (['manager_id', 'category', 'severity', 'status'].includes(key) && value) query = query.eq(key, value);
    }
    const { data, count, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar observacoes', { details: error });
    return { items: data || [], total: count ?? (data || []).length, limit, offset };
  }
  const items = sortRows(applyFilters(store.filter((row) => row.account_id === accountId), normalized));
  return { items: items.slice(offset, offset + limit).map(shape), total: items.length, limit, offset };
}

export async function getObservationById(context = {}, id) {
  const accountId = context?.accountId || null;
  assertAccountId(accountId);
  const observationId = String(id ?? '').trim();
  if (!observationId) throw new BadRequestError('id obrigatorio');
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('ai_director_observations').select('*').eq('account_id', accountId).eq('id', observationId).single();
    if (error) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
    return data;
  }
  const item = store.find((row) => row.account_id === accountId && row.id === observationId);
  if (!item) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
  return shape(item);
}

export async function createObservation(context = {}, payload = {}) {
  const accountId = context?.accountId || null;
  assertAccountId(accountId);
  const normalized = normalizeCreateObservationPayload(payload);
  const errors = validateObservationPayload(normalized);
  if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
  const row = { id: randomUUID(), account_id: accountId, ...normalized, metadata: normalized.metadata || {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('ai_director_observations').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar observacao', { details: error });
    return data;
  }
  store.push(row);
  return shape(row);
}

export async function updateObservationStatus(context = {}, id, payload = {}) {
  const accountId = context?.accountId || null;
  assertAccountId(accountId);
  const observationId = String(id ?? '').trim();
  const normalized = normalizeUpdateObservationPayload(payload);
  const errors = validateObservationPayload(normalized, { partial: true });
  if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('ai_director_observations').update(normalized).eq('account_id', accountId).eq('id', observationId).select('*').single();
    if (error) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
    return data;
  }
  const item = store.find((row) => row.account_id === accountId && row.id === observationId);
  if (!item) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
  Object.assign(item, normalized, { updated_at: new Date().toISOString() });
  return shape(item);
}

export async function getOpenObservationsForDirector(context = {}, options = {}) {
  return listObservations(context, { status: 'open', limit: options.limit ?? 10 });
}

export function __resetMemoryAiDirectorObservationsForTests() { store.length = 0; }
