import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { AiDirectorEventsQueries } from '../../database/queries/ai-director-events.queries.js';
import { isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryEvents = [];
const validStatus = new Set(['aberto', 'resolvido', 'reaberto']);
const validEventTypes = new Set(['observation_created', 'observation_resolved', 'observation_reopened', 'priority_created', 'action_plan_created', 'action_plan_completed', 'task_created', 'task_completed', 'sales_task_delegated', 'sales_task_generated', 'cycle_closed', 'cycle_reopened']);
const validEntityTypes = new Set(['observacao', 'prioridade', 'plano_acao', 'tarefa', 'ciclo', 'job']);
let repositoryOverride = null;

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-events' }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
function resolveRepository() { return repositoryOverride || repository; }
function normalizeText(value) { return String(value || '').trim(); }
function shouldUseDatabase() { return isSupabaseConfigured(); }

function normalizePayload(payload = {}) {
  const event_type = normalizeText(payload.event_type);
  if (!validEventTypes.has(event_type)) throw new BadRequestError('event_type invalido');
  const status = normalizeText(payload.status || 'aberto');
  if (!validStatus.has(status)) throw new BadRequestError('status invalido');
  const entity_type = normalizeText(payload.entity_type);
  if (!validEntityTypes.has(entity_type)) throw new BadRequestError('entity_type invalido');
  const entity_id = normalizeText(payload.entity_id);
  const title = normalizeText(payload.title);
  const description = normalizeText(payload.description);
  if (!entity_id) throw new BadRequestError('entity_id obrigatorio');
  if (!title) throw new BadRequestError('title obrigatorio');
  if (!description) throw new BadRequestError('description obrigatorio');
  return {
    event_type,
    status,
    entity_type,
    entity_id,
    title,
    description,
    recurrence_count: Math.max(0, Number(payload.recurrence_count ?? 0) || 0),
    origin: normalizeText(payload.origin || payload.metadata?.origin || ''),
    category: normalizeText(payload.category || payload.metadata?.category || ''),
    metadata: payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata) ? payload.metadata : {}
  };
}

function buildWhere(filters = {}, params = []) {
  const where = [];
  if (filters.status && filters.status !== 'all') { params.push(filters.status); where.push(`status = $${params.length}`); }
  if (filters.event_type) { params.push(filters.event_type); where.push(`event_type = $${params.length}`); }
  if (filters.entity_type) { params.push(filters.entity_type); where.push(`entity_type = $${params.length}`); }
  if (filters.entity_id) { params.push(filters.entity_id); where.push(`entity_id = $${params.length}`); }
  if (filters.origin) { params.push(filters.origin); where.push(`origin = $${params.length}`); }
  if (filters.category) { params.push(filters.category); where.push(`category = $${params.length}`); }
  return where.join(' AND ');
}

class AiDirectorEventsRepository extends BaseRepository {
  constructor(adapter = database) { super(adapter, { logContext: 'ai-director-events' }); }

  async createEvent(accountId, payload = {}) {
    assertAccountId(accountId);
    const normalized = normalizePayload(payload);
    const row = { id: randomUUID(), account_id: accountId, ...normalized, created_at: nowIso(), updated_at: nowIso() };
    if (shouldUseDatabase()) {
      const created = await this.one(AiDirectorEventsQueries.insertEvent(), [row.id, row.account_id, row.event_type, row.status, row.entity_type, row.entity_id, row.title, row.description, row.recurrence_count, row.metadata, row.created_at, row.updated_at]);
      return created;
    }
    memoryEvents.push(row);
    logger.info('ai_director_event_created', { account_id: accountId, event_type: row.event_type, entity_type: row.entity_type, entity_id: row.entity_id, recurrence_count: row.recurrence_count });
    return clone(row);
  }

  async listEvents(accountId, filters = {}) {
    assertAccountId(accountId);
    const limit = Number(filters.limit ?? 50);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;
    const offset = Number(filters.offset ?? 0);
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
    if (shouldUseDatabase()) {
      const params = [accountId];
      const whereSql = buildWhere(filters, params);
      params.push(safeLimit, safeOffset);
      const rows = await this.many(AiDirectorEventsQueries.listEvents(whereSql), params);
      return { items: rows || [], total: (rows || []).length };
    }
    const items = memoryEvents
      .filter((row) => row.account_id === accountId)
      .filter((row) => !filters.status || filters.status === 'all' || row.status === filters.status)
      .filter((row) => !filters.event_type || row.event_type === filters.event_type)
      .filter((row) => !filters.entity_type || row.entity_type === filters.entity_type)
      .filter((row) => !filters.entity_id || row.entity_id === filters.entity_id)
      .filter((row) => !filters.origin || row.origin === filters.origin)
      .filter((row) => !filters.category || row.category === filters.category)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(safeOffset, safeOffset + safeLimit)
      .map(clone);
    return { items, total: items.length };
  }
}

const repository = new AiDirectorEventsRepository();

export async function createAiDirectorEvent(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  return resolveRepository().createEvent(accountId, payload);
}

export async function listAiDirectorEvents(accountId, filters = {}) {
  return resolveRepository().listEvents(accountId, filters);
}

export function __resetMemoryAiDirectorEventsForTests() {
  memoryEvents.length = 0;
  repositoryOverride = null;
}

export function __setAiDirectorEventsDatabaseForTests(adapter) {
  repositoryOverride = adapter instanceof AiDirectorEventsRepository ? adapter : new AiDirectorEventsRepository(adapter);
}
