import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
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

function logObservationDedupeCheck(event, payload = {}) {
  console.log(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    ...payload
  }));
}

function buildObservationKey(accountId, payload = {}) {
  const origin = String(payload.origin || payload.source_type || 'manual').trim();
  return [
    String(accountId || '').trim(),
    String(payload.manager_id || '').trim(),
    String(payload.category || '').trim(),
    String(payload.title || '').trim().toLowerCase(),
    origin.toLowerCase(),
    String(payload.metadata?.dedupe_key || payload.metadata?.dedupeKey || '').trim().toLowerCase()
  ].join('|');
}

function normalizeObservationMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function buildReopenMetadata(current = {}, payload = {}) {
  const currentMetadata = normalizeObservationMetadata(current.metadata);
  const history = Array.isArray(currentMetadata.history) ? currentMetadata.history.slice() : [];
  const now = new Date().toISOString();
  if (current.status === 'resolved') {
    history.push({
      event: 'resolved_cycle_reopened',
      status: current.status,
      resolved_at: currentMetadata.resolved_at || current.resolved_at || null,
      reopened_at: now
    });
  }
  const recurrenceCount = Number(currentMetadata.recurrence_count ?? currentMetadata.recurrencias ?? 0) || 0;
  return {
    ...currentMetadata,
    ...normalizeObservationMetadata(payload.metadata),
    recurrence_count: recurrenceCount + 1,
    recurrence_history: history,
    last_reopened_at: now,
    previous_resolved_at: currentMetadata.resolved_at || current.resolved_at || null,
    resolved_at: null
  };
}

function isResolvedEquivalent(row, accountId, payload) {
  return (
    row &&
    row.account_id === accountId &&
    row.status === 'resolved' &&
    row.manager_id === payload.manager_id &&
    row.category === payload.category &&
    row.title === payload.title &&
    String(row.origin || row.source_type || '') === String(payload.origin || payload.source_type || 'manual') &&
    buildObservationKey(accountId, { ...row, origin: row.origin || row.source_type || 'manual', metadata: row.metadata || {} }) === buildObservationKey(accountId, payload)
  );
}

function isOpenEquivalent(row, accountId, payload) {
  return (
    row &&
    row.account_id === accountId &&
    row.status === 'open' &&
    row.manager_id === payload.manager_id &&
    row.category === payload.category &&
    row.title === payload.title &&
    String(row.origin || row.source_type || '') === String(payload.origin || payload.source_type || 'manual') &&
    buildObservationKey(accountId, { ...row, origin: row.origin || row.source_type || 'manual', metadata: row.metadata || {} }) === buildObservationKey(accountId, payload)
  );
}

async function cleanupDuplicateOpenObservations(supabase, accountId, payload) {
  const origin = String(payload.origin || payload.source_type || 'manual').trim();
  const dedupeKey = String(payload.metadata?.dedupe_key || payload.metadata?.dedupeKey || '').trim();
  const queryFilters = {
    account_id: accountId,
    manager_id: payload.manager_id,
    category: payload.category,
    title: payload.title,
    status: 'open',
    origin,
    dedupe_key: dedupeKey || null
  };
  logObservationDedupeCheck('observation_dedupe_check_started', { filters: queryFilters });

  try {
    const { data, error } = await supabase
      .from('ai_director_observations')
      .select('*')
      .eq('account_id', accountId)
      .eq('manager_id', payload.manager_id)
      .eq('category', payload.category)
      .eq('title', payload.title)
      .eq('status', 'open')
      .eq('origin', origin)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      logObservationDedupeCheck('observation_dedupe_check_failed', {
        filters: queryFilters,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          stack: error.stack
        }
      });
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length <= 1) return rows[0] || null;

    const [latest, ...duplicates] = rows;
    const duplicateIds = duplicates.map((row) => row.id).filter(Boolean);
    if (duplicateIds.length > 0) {
      const { error: deleteError } = await supabase.from('ai_director_observations').delete().in('id', duplicateIds);
      if (deleteError) throw new DatabaseError('Falha ao remover observacoes duplicadas', { details: deleteError });
    }

    return latest || null;
  } catch (error) {
    if (error?.message !== 'Falha ao remover observacoes duplicadas') {
      logObservationDedupeCheck('observation_dedupe_check_failed', {
        filters: queryFilters,
        error: {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          stack: error?.stack
        }
      });
    }
    throw error;
  }
}

async function reopenResolvedObservation(supabase, accountId, payload) {
  const { data, error } = await supabase
    .from('ai_director_observations')
    .select('*')
    .eq('account_id', accountId)
    .eq('manager_id', payload.manager_id)
    .eq('category', payload.category)
    .eq('title', payload.title)
    .eq('status', 'resolved')
    .eq('origin', String(payload.origin || payload.source_type || 'manual').trim())
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) throw new DatabaseError('Falha ao consultar observacao resolvida', { details: error });
  const rows = Array.isArray(data) ? data : [];
  const current = rows.find((row) => isResolvedEquivalent(row, accountId, payload)) || null;
  if (!current) return null;

  const metadata = buildReopenMetadata(current, payload);
  const updatePayload = {
    status: 'open',
    metadata,
    updated_at: new Date().toISOString()
  };
  const { data: updated, error: updateError } = await supabase
    .from('ai_director_observations')
    .update(updatePayload)
    .eq('account_id', accountId)
    .eq('id', current.id)
    .select('*')
    .single();
  if (updateError) throw new DatabaseError('Falha ao reabrir observacao', { details: updateError });
  logger.info('ai_director_cycle_reopened', {
    account_id: accountId,
    observation_id: updated?.id || current.id,
    recurrence_count: metadata.recurrence_count,
    previous_resolved_at: metadata.previous_resolved_at || null
  });
  return updated;
}

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

  // Supabase/PostgREST can lag behind migrations; keep observation-only fields
  // in metadata so persistence still works even when schema cache is stale.
  const metadata = {
    ...(normalized.metadata || {}),
    ...(normalized.impact ? { impact: normalized.impact } : {}),
    ...(normalized.urgency ? { urgency: normalized.urgency } : {})
  };
  const row = {
    id: randomUUID(),
    account_id: accountId,
    manager_id: normalized.manager_id,
    manager_name: normalized.manager_name,
    category: normalized.category,
    title: normalized.title,
    description: normalized.description,
    severity: normalized.severity,
    impact_score: normalized.impact_score,
    urgency_score: normalized.urgency_score,
    status: normalized.status,
    source_type: normalized.source_type,
    source_id: normalized.source_id,
    metadata,
    origin: payload.origin || payload.source_type || 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
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

function isEquivalentOpenObservation(row, payload) {
  return (
    row &&
    isOpenEquivalent(row, payload.account_id, payload) &&
    String(row.source_id ?? '') === String(payload.source_id ?? '')
  );
}

export async function createObservationIfNotOpen(context = {}, payload = {}) {
  const accountId = context?.accountId || null;
  assertAccountId(accountId);
  const normalized = normalizeCreateObservationPayload(payload);
  const errors = validateObservationPayload(normalized);
  if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const origin = String(payload.origin || payload.source_type || 'manual').trim();
    const current = await cleanupDuplicateOpenObservations(supabase, accountId, { ...normalized, account_id: accountId, origin });
    if (current && isOpenEquivalent(current, accountId, { ...normalized, account_id: accountId, origin })) {
      return { created: false, reason: 'duplicate', observation: current };
    }
    const reopened = await reopenResolvedObservation(supabase, accountId, { ...normalized, account_id: accountId, origin });
    if (reopened) {
      return { created: false, reason: 'reopened', observation: reopened };
    }
  }

  const openEquivalent = mode() === 'supabase'
    ? null
    : store.find((row) => isEquivalentOpenObservation(row, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' })) || null;
  if (openEquivalent) {
    return { created: false, reason: 'duplicate', observation: shape(openEquivalent) };
  }

  const resolvedEquivalent = mode() === 'supabase'
    ? null
    : store.find((row) => isResolvedEquivalent(row, accountId, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' })) || null;
  if (resolvedEquivalent) {
    const now = new Date().toISOString();
    const metadata = buildReopenMetadata(resolvedEquivalent, { metadata: normalized.metadata || {} });
    Object.assign(resolvedEquivalent, {
      status: 'open',
      metadata,
      updated_at: now
    });
    logger.info('ai_director_cycle_reopened', {
      account_id: accountId,
      observation_id: resolvedEquivalent.id,
      recurrence_count: metadata.recurrence_count,
      previous_resolved_at: metadata.previous_resolved_at || null
    });
    return { created: false, reason: 'reopened', observation: shape(resolvedEquivalent) };
  }

  const observation = await createObservation(context, { ...normalized, metadata: normalized.metadata || {} });
  return { created: true, observation };
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
    const { data: current, error: currentError } = await supabase.from('ai_director_observations').select('*').eq('account_id', accountId).eq('id', observationId).maybeSingle();
    if (currentError) throw new DatabaseError('Falha ao consultar observacao', { details: currentError });
    if (!current) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
    const updatePayload = {
      ...normalized,
      metadata: normalized.metadata !== undefined ? { ...(current.metadata || {}), ...(normalized.metadata || {}) } : current.metadata,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('ai_director_observations').update(updatePayload).eq('account_id', accountId).eq('id', observationId).select('*').single();
    if (error) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
    return data;
  }
  const item = store.find((row) => row.account_id === accountId && row.id === observationId);
  if (!item) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
  Object.assign(item, {
    ...normalized,
    metadata: normalized.metadata !== undefined ? { ...(item.metadata || {}), ...(normalized.metadata || {}) } : item.metadata,
    updated_at: new Date().toISOString()
  });
  return shape(item);
}

export async function getOpenObservationsForDirector(context = {}, options = {}) {
  return listObservations(context, { status: 'open', limit: options.limit ?? 10 });
}

export function __resetMemoryAiDirectorObservationsForTests() { store.length = 0; }
