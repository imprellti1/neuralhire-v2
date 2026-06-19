import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { logger } from '../../core/logger.js';

const store = [];
const validStatus = new Set(['aberto', 'resolvido', 'reaberto']);
const validEventTypes = new Set([
  'observation_created',
  'observation_resolved',
  'observation_reopened',
  'priority_created',
  'action_plan_created',
  'action_plan_completed',
  'task_created',
  'task_completed',
  'sales_task_delegated',
  'sales_task_generated',
  'cycle_closed',
  'cycle_reopened'
]);

function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-events' }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }

function normalizePayload(payload = {}) {
  const event_type = String(payload.event_type || '').trim();
  if (!validEventTypes.has(event_type)) throw new BadRequestError('event_type invalido');
  const status = String(payload.status || 'aberto').trim();
  if (!validStatus.has(status)) throw new BadRequestError('status invalido');
  const entity_type = String(payload.entity_type || '').trim();
  const entity_id = String(payload.entity_id || '').trim();
  const title = String(payload.title || '').trim();
  const description = String(payload.description || '').trim();
  if (!entity_type) throw new BadRequestError('entity_type obrigatorio');
  if (!entity_id) throw new BadRequestError('entity_id obrigatorio');
  if (!title) throw new BadRequestError('title obrigatorio');
  if (!description) throw new BadRequestError('description obrigatorio');
  const recurrence_count = Math.max(0, Number(payload.recurrence_count ?? 0) || 0);
  return { event_type, status, entity_type, entity_id, title, description, recurrence_count, metadata: payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata) ? payload.metadata : {} };
}

export async function createAiDirectorEvent(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  assertAccountId(accountId);
  const normalized = normalizePayload(payload);
  const row = { id: randomUUID(), account_id: accountId, ...normalized, created_at: nowIso(), updated_at: nowIso() };
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('ai_director_events').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar evento do diretor IA', { details: error });
    return data;
  }
  store.push(row);
  logger.info('ai_director_event_created', { account_id: accountId, event_type: row.event_type, entity_type: row.entity_type, entity_id: row.entity_id, recurrence_count: row.recurrence_count });
  return clone(row);
}

export async function listAiDirectorEvents(accountId, filters = {}) {
  assertAccountId(accountId);
  const limit = Number(filters.limit ?? 50);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;
  const status = filters.status ? String(filters.status).trim() : null;
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('ai_director_events').select('*').eq('account_id', accountId).order('created_at', { ascending: false }).limit(safeLimit);
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar eventos do diretor IA', { details: error });
    return { items: data || [], total: (data || []).length };
  }
  const items = store
    .filter((row) => row.account_id === accountId)
    .filter((row) => !status || status === 'all' || row.status === status)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, safeLimit)
    .map(clone);
  return { items, total: items.length };
}

export function __resetMemoryAiDirectorEventsForTests() {
  store.length = 0;
}
