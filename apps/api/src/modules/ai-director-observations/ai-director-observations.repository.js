import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { AiDirectorObservationsQueries } from '../../database/queries/ai-director-observations.queries.js';
import { normalizeCreateObservationPayload, normalizeUpdateObservationPayload, validateObservationPayload } from './ai-director-observations.schemas.js';
import { createAiDirectorEvent } from '../ai-director/ai-director-events.repository.js';

const store = [];
let repositoryOverride = null;

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-observations' }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
function resolveRepository() { return repositoryOverride || repository; }

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
  console.log(JSON.stringify({ event, timestamp: nowIso(), ...payload }));
}

function buildObservationKey(accountId, payload = {}) {
  const origin = String(payload.origin || payload.source_type || 'manual').trim();
  return [String(accountId || '').trim(), String(payload.manager_id || '').trim(), String(payload.category || '').trim(), String(payload.title || '').trim().toLowerCase(), origin.toLowerCase(), String(payload.metadata?.dedupe_key || payload.metadata?.dedupeKey || '').trim().toLowerCase()].join('|');
}

function normalizeObservationMetadata(metadata) { return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}; }

function buildReopenMetadata(current = {}, payload = {}) {
  const currentMetadata = normalizeObservationMetadata(current.metadata);
  const history = Array.isArray(currentMetadata.recurrence_history) ? currentMetadata.recurrence_history.slice() : Array.isArray(currentMetadata.history) ? currentMetadata.history.slice() : [];
  const now = nowIso();
  if (current.status === 'resolved') history.push({ event: 'resolved_cycle_reopened', status: current.status, resolved_at: currentMetadata.resolved_at || current.resolved_at || null, reopened_at: now });
  const recurrenceCount = Number(currentMetadata.recurrence_count ?? currentMetadata.recurrencias ?? 0) || 0;
  return { ...currentMetadata, ...normalizeObservationMetadata(payload.metadata), recurrence_count: recurrenceCount + 1, recurrence_history: history, last_reopened_at: now, previous_resolved_at: currentMetadata.resolved_at || current.resolved_at || null, resolved_at: null };
}

function isResolvedEquivalent(row, accountId, payload) { return row && row.account_id === accountId && row.status === 'resolved' && row.manager_id === payload.manager_id && row.category === payload.category && row.title === payload.title && String(row.origin || row.source_type || '') === String(payload.origin || payload.source_type || 'manual') && buildObservationKey(accountId, { ...row, origin: row.origin || row.source_type || 'manual', metadata: row.metadata || {} }) === buildObservationKey(accountId, payload); }
function isOpenEquivalent(row, accountId, payload) { return row && row.account_id === accountId && row.status === 'open' && row.manager_id === payload.manager_id && row.category === payload.category && row.title === payload.title && String(row.origin || row.source_type || '') === String(payload.origin || payload.source_type || 'manual') && buildObservationKey(accountId, { ...row, origin: row.origin || row.source_type || 'manual', metadata: row.metadata || {} }) === buildObservationKey(accountId, payload); }

function toSafeRow(row = {}) {
  return { id: row.id || randomUUID(), account_id: row.account_id ?? null, manager_id: row.manager_id, manager_name: row.manager_name, category: row.category, title: row.title, description: row.description, severity: row.severity, impact_score: row.impact_score ?? null, urgency_score: row.urgency_score ?? null, status: row.status, source_type: row.source_type ?? null, source_id: row.source_id ?? null, metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}, origin: row.origin || row.source_type || 'manual', created_at: row.created_at || nowIso(), updated_at: row.updated_at || nowIso() };
}

class AiDirectorObservationsRepository extends BaseRepository {
  constructor(adapter = database) { super(adapter, { logContext: 'ai-director-observations' }); }

  async listObservations(accountId, filters = {}) {
    const normalized = normalizeFilters(filters);
    const limit = Number.isFinite(normalized.limit) && normalized.limit > 0 ? Math.min(Math.floor(normalized.limit), 100) : 20;
    const offset = Number.isFinite(normalized.offset) && normalized.offset >= 0 ? Math.floor(normalized.offset) : 0;
    const rows = normalized.manager_id || normalized.category || normalized.severity || normalized.status
      ? await this.many(AiDirectorObservationsQueries.listObservationsByFilters([
        normalized.manager_id ? `manager_id = '${String(normalized.manager_id).replace(/'/g, "''")}'` : '',
        normalized.category ? `category = '${String(normalized.category).replace(/'/g, "''")}'` : '',
        normalized.severity ? `severity = '${String(normalized.severity).replace(/'/g, "''")}'` : '',
        normalized.status ? `status = '${String(normalized.status).replace(/'/g, "''")}'` : ''
      ].filter(Boolean).join(' AND ')), [accountId, limit, offset])
      : await this.many(AiDirectorObservationsQueries.listObservations(), [accountId, limit, offset]);
    return { items: rows || [], total: (rows || []).length, limit, offset };
  }

  async getObservationById(accountId, id) {
    const observationId = String(id ?? '').trim();
    if (!observationId) throw new BadRequestError('id obrigatorio');
    try { return await this.one(AiDirectorObservationsQueries.getObservationById(), [accountId, observationId]); }
    catch (error) { if (error?.code === 'DATABASE_NOT_ONE') throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' }); throw error; }
  }

  async createObservation(accountId, payload = {}) {
    const normalized = normalizeCreateObservationPayload(payload);
    const errors = validateObservationPayload(normalized);
    if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
    const metadata = { ...(normalized.metadata || {}), ...(normalized.impact ? { impact: normalized.impact } : {}), ...(normalized.urgency ? { urgency: normalized.urgency } : {}) };
    const row = toSafeRow({ id: randomUUID(), account_id: accountId, manager_id: normalized.manager_id, manager_name: normalized.manager_name, category: normalized.category, title: normalized.title, description: normalized.description, severity: normalized.severity, impact_score: normalized.impact_score, urgency_score: normalized.urgency_score, status: normalized.status, source_type: normalized.source_type, source_id: normalized.source_id, metadata, origin: payload.origin || payload.source_type || 'manual' });
    const created = await this.one(AiDirectorObservationsQueries.insertObservation(), [row.id, row.account_id, row.manager_id, row.manager_name, row.category, row.title, row.description, row.severity, row.impact_score, row.urgency_score, row.status, row.source_type, row.source_id, row.metadata, row.origin, row.created_at, row.updated_at]);
    void createAiDirectorEvent({ event_type: 'observation_created', entity_type: 'observacao', entity_id: created.id, status: 'aberto', title: created.title, description: created.description, recurrence_count: Number(created.metadata?.recurrence_count ?? 0) || 0, metadata: { observation_id: created.id, manager_id: created.manager_id, category: created.category } }, { accountId }).catch(() => {});
    return created;
  }

  async createObservationIfNotOpen(accountId, payload = {}) {
    const normalized = normalizeCreateObservationPayload(payload);
    const errors = validateObservationPayload(normalized);
    if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
    const openEquivalent = await cleanupDuplicateOpenObservations(accountId, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' });
    if (openEquivalent && isOpenEquivalent(openEquivalent, accountId, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' })) return { created: false, reason: 'duplicate', observation: shape(openEquivalent) };
    const reopened = await reopenResolvedObservation(accountId, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' });
    if (reopened) return { created: false, reason: 'reopened', observation: reopened };
    const observation = await this.createObservation(accountId, { ...normalized, metadata: normalized.metadata || {} });
    return { created: true, observation };
  }

  async updateObservationStatus(accountId, id, payload = {}) {
    const observationId = String(id ?? '').trim();
    const normalized = normalizeUpdateObservationPayload(payload);
    const errors = validateObservationPayload(normalized, { partial: true });
    if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
    const current = await this.one(AiDirectorObservationsQueries.getObservationById(), [accountId, observationId]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
      throw error;
    });
    const updatePayload = { status: normalized.status ?? current.status, metadata: normalized.metadata !== undefined ? { ...(current.metadata || {}), ...(normalized.metadata || {}) } : current.metadata, updated_at: nowIso() };
    const updated = await this.one(AiDirectorObservationsQueries.updateObservationById(), [accountId, observationId, updatePayload.status, updatePayload.metadata, updatePayload.updated_at]);
    if (String(normalized.status || '').trim() === 'resolved') void createAiDirectorEvent({ event_type: 'observation_resolved', entity_type: 'observacao', entity_id: updated.id, status: 'resolvido', title: updated.title, description: updated.description, recurrence_count: Number(updated.metadata?.recurrence_count ?? 0) || 0, metadata: { observation_id: updated.id, resolved_at: updated.updated_at } }, { accountId }).catch(() => {});
    return updated;
  }

  async getOpenObservationsForDirector(accountId, options = {}) {
    return this.listObservations(accountId, { status: 'open', limit: options.limit ?? 10 });
  }

  async deleteDuplicateObservations(accountId, duplicateIds = []) {
    if (!duplicateIds.length) return [];
    if (this.database?.query) {
      await this.execute(AiDirectorObservationsQueries.deleteObservationsByIds(), [duplicateIds]);
      return duplicateIds;
    }
    const ids = new Set(duplicateIds.map((item) => String(item)));
    for (let i = store.length - 1; i >= 0; i -= 1) if (store[i].account_id === accountId && ids.has(String(store[i].id))) store.splice(i, 1);
    return duplicateIds;
  }
}

const repository = new AiDirectorObservationsRepository();

async function cleanupDuplicateOpenObservations(accountId, payload) {
  const origin = String(payload.origin || payload.source_type || 'manual').trim();
  const dedupeKey = String(payload.metadata?.dedupe_key || payload.metadata?.dedupeKey || '').trim();
  const queryFilters = { account_id: accountId, manager_id: payload.manager_id, category: payload.category, title: payload.title, status: 'open', origin, dedupe_key: dedupeKey || null };
  logObservationDedupeCheck('observation_dedupe_check_started', { filters: queryFilters });
  try {
    const rows = repositoryOverride
      ? await repositoryOverride.many(AiDirectorObservationsQueries.getObservationByEquivalentKey(), [accountId, payload.manager_id, payload.category, payload.title, 'open', origin])
      : store.filter((row) => row.account_id === accountId && row.manager_id === payload.manager_id && row.category === payload.category && row.title === payload.title && row.status === 'open' && String(row.origin || row.source_type || '').trim() === origin).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 10);
    if (!Array.isArray(rows) || rows.length <= 1) return rows?.[0] || null;
    const [latest, ...duplicates] = rows;
    const duplicateIds = duplicates.map((row) => row.id).filter(Boolean);
    if (duplicateIds.length > 0) {
      await repository.deleteDuplicateObservations(accountId, duplicateIds);
    }
    return latest || null;
  } catch (error) {
    logObservationDedupeCheck('observation_dedupe_check_failed', { filters: queryFilters, error: { message: error?.message, code: error?.code, details: error?.details, hint: error?.hint, stack: error?.stack } });
    throw error;
  }
}

async function reopenResolvedObservation(accountId, payload) {
  if (repositoryOverride) {
    const rows = await repositoryOverride.many(AiDirectorObservationsQueries.getObservationByEquivalentKey(), [accountId, payload.manager_id, payload.category, payload.title, 'resolved', String(payload.origin || payload.source_type || 'manual').trim()]);
    const current = rows.find((row) => isResolvedEquivalent(row, accountId, payload)) || null;
    if (!current) return null;
    const metadata = buildReopenMetadata(current, payload);
    const updated = await resolveRepository().one(AiDirectorObservationsQueries.updateObservationById(), [accountId, current.id, 'open', metadata, nowIso()]);
    logger.info('ai_director_cycle_reopened', { account_id: accountId, observation_id: updated?.id || current.id, recurrence_count: metadata.recurrence_count, previous_resolved_at: metadata.previous_resolved_at || null });
    return updated;
  }
  const current = store.find((row) => isResolvedEquivalent(row, accountId, payload)) || null;
  if (!current) return null;
  const metadata = buildReopenMetadata(current, payload);
  Object.assign(current, { status: 'open', metadata, updated_at: nowIso() });
  logger.info('ai_director_cycle_reopened', { account_id: accountId, observation_id: current.id, recurrence_count: metadata.recurrence_count, previous_resolved_at: metadata.previous_resolved_at || null });
  return shape(current);
}

export async function listObservations(context = {}, filters = {}) {
  const accountId = context?.accountId || null; assertAccountId(accountId);
  if (repositoryOverride) return repositoryOverride.listObservations(accountId, filters);
  const normalized = normalizeFilters(filters);
  const items = sortRows(applyFilters(store.filter((row) => row.account_id === accountId), normalized));
  const limit = Number.isFinite(normalized.limit) && normalized.limit > 0 ? Math.min(Math.floor(normalized.limit), 100) : 20;
  const offset = Number.isFinite(normalized.offset) && normalized.offset >= 0 ? Math.floor(normalized.offset) : 0;
  return { items: items.slice(offset, offset + limit).map(shape), total: items.length, limit, offset };
}

export async function getObservationById(context = {}, id) {
  const accountId = context?.accountId || null; assertAccountId(accountId);
  if (repositoryOverride) return repositoryOverride.getObservationById(accountId, id);
  const observationId = String(id ?? '').trim();
  if (!observationId) throw new BadRequestError('id obrigatorio');
  const item = store.find((row) => row.account_id === accountId && row.id === observationId);
  if (!item) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
  return shape(item);
}

export async function createObservation(context = {}, payload = {}) {
  const accountId = context?.accountId || null; assertAccountId(accountId);
  if (repositoryOverride) return repositoryOverride.createObservation(accountId, payload);
  const normalized = normalizeCreateObservationPayload(payload);
  const errors = validateObservationPayload(normalized);
  if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
  const metadata = { ...(normalized.metadata || {}), ...(normalized.impact ? { impact: normalized.impact } : {}), ...(normalized.urgency ? { urgency: normalized.urgency } : {}) };
  const row = { id: randomUUID(), account_id: accountId, manager_id: normalized.manager_id, manager_name: normalized.manager_name, category: normalized.category, title: normalized.title, description: normalized.description, severity: normalized.severity, impact_score: normalized.impact_score, urgency_score: normalized.urgency_score, status: normalized.status, source_type: normalized.source_type, source_id: normalized.source_id, metadata, origin: payload.origin || payload.source_type || 'manual', created_at: nowIso(), updated_at: nowIso() };
  store.push(row);
  void createAiDirectorEvent({ event_type: 'observation_created', entity_type: 'observacao', entity_id: row.id, status: 'aberto', title: row.title, description: row.description, recurrence_count: Number(row.metadata?.recurrence_count ?? 0) || 0, metadata: { observation_id: row.id, manager_id: row.manager_id, category: row.category } }, { accountId }).catch(() => {});
  return shape(row);
}

export async function createObservationIfNotOpen(context = {}, payload = {}) {
  const accountId = context?.accountId || null; assertAccountId(accountId);
  const normalized = normalizeCreateObservationPayload(payload);
  const errors = validateObservationPayload(normalized);
  if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
  const current = await cleanupDuplicateOpenObservations(accountId, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' });
  if (current && isOpenEquivalent(current, accountId, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' })) {
    return { created: false, reason: 'duplicate', observation: shape(current) };
  }
  const reopened = await reopenResolvedObservation(accountId, { ...normalized, account_id: accountId, origin: payload.origin || payload.source_type || 'manual' });
  if (reopened) return { created: false, reason: 'reopened', observation: reopened };
  const observation = await createObservation(context, { ...normalized, metadata: normalized.metadata || {} });
  return { created: true, observation };
}

export async function updateObservationStatus(context = {}, id, payload = {}) {
  const accountId = context?.accountId || null; assertAccountId(accountId);
  if (repositoryOverride) return repositoryOverride.updateObservationStatus(accountId, id, payload);
  const observationId = String(id ?? '').trim();
  const normalized = normalizeUpdateObservationPayload(payload);
  const errors = validateObservationPayload(normalized, { partial: true });
  if (errors.length) throw new BadRequestError('Dados invalidos', { details: errors, domain: 'ai-director-observations' });
  const item = store.find((row) => row.account_id === accountId && row.id === observationId);
  if (!item) throw new NotFoundError('Observacao nao encontrada', { domain: 'ai-director-observations', code: 'AI_DIRECTOR_OBSERVATION_NOT_FOUND' });
  Object.assign(item, { ...normalized, metadata: normalized.metadata !== undefined ? { ...(item.metadata || {}), ...(normalized.metadata || {}) } : item.metadata, updated_at: nowIso() });
  if (String(normalized.status || '').trim() === 'resolved') void createAiDirectorEvent({ event_type: 'observation_resolved', entity_type: 'observacao', entity_id: item.id, status: 'resolvido', title: item.title, description: item.description, recurrence_count: Number(item.metadata?.recurrence_count ?? 0) || 0, metadata: { observation_id: item.id, resolved_at: item.updated_at } }, { accountId }).catch(() => {});
  return shape(item);
}

export async function getOpenObservationsForDirector(context = {}, options = {}) {
  const accountId = context?.accountId || null; assertAccountId(accountId);
  return listObservations({ accountId }, { status: 'open', limit: options.limit ?? 10 });
}

export function __resetMemoryAiDirectorObservationsForTests() { store.length = 0; repositoryOverride = null; }
export function __dumpMemoryAiDirectorObservationsForTests() { return store.map((item) => ({ ...item })); }
export function __setAiDirectorObservationsDatabaseForTests(adapter) { repositoryOverride = adapter instanceof AiDirectorObservationsRepository ? adapter : new AiDirectorObservationsRepository(adapter); }
