import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { AiDirectorTasksQueries } from '../../database/queries/ai-director-tasks.queries.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getClienteById } from '../clientes/clientes.repository.js';
import { listActionPlans, listActionPlansByExecutiveMemoryId, updateActionPlanStatus } from './ai-director-action-plans.repository.js';
import { listObservations, updateObservationStatus } from '../ai-director-observations/ai-director-observations.repository.js';
import { getManagerById } from './ai-director.repository.js';
import { createAiDirectorEvent } from './ai-director-events.repository.js';

const validStatus = new Set(['open', 'in_progress', 'done', 'dismissed']);
const validLegacyStatus = new Map([
  ['aberto', 'open'],
  ['em_andamento', 'in_progress'],
  ['concluido', 'done'],
  ['bloqueado', 'dismissed'],
  ['cancelado', 'dismissed'],
  ['ignorado', 'dismissed']
]);
const validImpactToPriority = { alto: 'high', high: 'high', media: 'medium', medio: 'medium', baixa: 'low', low: 'low' };
const prioritySlaDays = { critical: 1, high: 3, medium: 7, low: 15 };
const memoryTasks = [];
const legacyGerenteColumnCache = { checked: false, supported: false };
let repositoryOverride = null;

class AiDirectorTasksRepository extends BaseRepository {
  constructor(adapter = database) {
    super(adapter, { logContext: 'ai-director-tasks' });
  }
}

const repository = new AiDirectorTasksRepository();

function resolveRepository() {
  return repositoryOverride || repository;
}

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-tasks' });
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
function addHoursIso(hours) {
  return new Date(Date.now() + Number(hours) * 60 * 60 * 1000).toISOString();
}
function addDaysIso(days) {
  return new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
}
function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}
export function normalizeDirectorTaskKey(value) {
  return normalizeText(value);
}
function normalizeManagerName(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.replace(/\s+/g, ' ');
}
function normalizeStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  return validStatus.has(raw) ? raw : (validLegacyStatus.get(raw) || 'open');
}
function normalizePriority(impacto, prioridadeScore = 0) {
  const mapped = validImpactToPriority[String(impacto || '').toLowerCase()];
  if (mapped) return mapped;
  const score = Number(prioridadeScore) || 0;
  if (score >= 100) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}
function normalizeTaskPriority(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'critical') return 'critical';
  if (raw === 'high') return 'high';
  if (raw === 'medium') return 'medium';
  if (raw === 'low') return 'low';
  return 'medium';
}
function resolveTaskDueDate(priority) {
  const normalized = normalizeTaskPriority(priority);
  if (normalized === 'critical') return addHoursIso(24);
  const days = prioritySlaDays[normalized];
  return days ? addDaysIso(days) : null;
}
function normalizeCategory(actionPlan = {}) {
  return String(actionPlan.category || actionPlan.categoria || actionPlan.gerente_responsavel || 'geral').trim() || 'geral';
}
function resolveManager(actionPlan = {}) {
  const managerId = String(actionPlan.gerente_responsavel || '').trim() || null;
  const managerName = getManagerById(managerId)?.nome || normalizeManagerName(actionPlan.manager_name || actionPlan.gerente_nome || managerId?.replace(/_/g, ' ')) || null;
  return { manager_id: managerId, manager_name: managerName };
}
function taskIdentityKey(row = {}) {
  return [String(row.account_id || ''), String(row.action_plan_id || ''), String(row.manager_id || ''), String(row.manager_name || '').toLowerCase(), String(row.status || '')].join('|');
}
function dedupeKeyFromRow(row = {}) {
  return [String(row.account_id || ''), String(row.action_plan_id || ''), String(row.manager_id || row.manager_name || ''), String(row.status || '')].join('|');
}
function buildLegacyGerenteValue(row = {}) {
  return normalizeManagerName(row.manager_name) || String(row.manager_id || '').trim() || 'gerente_comercial';
}
function normalizeDelegationReason(value) {
  const reason = String(value || '').trim();
  return reason || null;
}
function normalizeSellerTaskReason(value) {
  const reason = String(value || '').trim();
  return reason || null;
}
function buildTaskContextFromCliente(cliente = {}, fallback = {}) {
  return {
    vendedor_id: String(cliente.vendedor_id || fallback.vendedor_id || '').trim() || null,
    vendedor_name: normalizeManagerName(cliente.vendedor_nome || fallback.vendedor_name) || null
  };
}
async function resolveTaskDelegation(payload = {}, options = {}) {
  const cliente_id = String(payload.cliente_id || '').trim() || null;
  const fallbackVendedorId = String(payload.vendedor_id || payload.manager_id || '').trim() || null;
  const fallbackVendedorName = normalizeManagerName(payload.vendedor_name || payload.manager_name);
  if (!cliente_id) {
    return {
      cliente_id: null,
      vendedor_id: fallbackVendedorId,
      vendedor_name: fallbackVendedorName,
      delegation_level: String(payload.delegation_level || (fallbackVendedorId ? 'vendedor' : 'gerente')).trim() || 'gerente',
      delegation_reason: normalizeDelegationReason(payload.delegation_reason),
      delegationEvent: null
    };
  }
  const cliente = await getClienteById(cliente_id, { accountId: payload.account_id || options.accountId, context: options.context }).catch(() => null);
  const resolved = cliente ? buildTaskContextFromCliente(cliente, { vendedor_id: fallbackVendedorId, vendedor_name: fallbackVendedorName }) : { vendedor_id: fallbackVendedorId, vendedor_name: fallbackVendedorName };
  if (resolved.vendedor_id && resolved.vendedor_id !== fallbackVendedorId) {
    return {
      cliente_id,
      vendedor_id: resolved.vendedor_id,
      vendedor_name: resolved.vendedor_name || fallbackVendedorName || normalizeManagerName(resolved.vendedor_id),
      delegation_level: 'vendedor',
      delegation_reason: null,
      delegationEvent: {
        event_type: 'sales_task_delegated',
        entity_type: 'tarefa',
        entity_id: payload.id || randomUUID(),
        status: 'aberto',
        title: String(payload.title || payload.titulo || 'Tarefa comercial').trim() || 'Tarefa comercial',
        description: String(payload.description || payload.descricao || 'Tarefa comercial delegada ao vendedor responsável.').trim() || 'Tarefa comercial delegada ao vendedor responsável.',
        recurrence_count: 0,
        metadata: { task_id: payload.id || null, vendedor_id: resolved.vendedor_id, cliente_id, origin: 'gerente_comercial_ia' }
      }
    };
  }
  return {
    cliente_id,
    vendedor_id: null,
    vendedor_name: null,
    delegation_level: String(payload.delegation_level || 'gerente').trim() || 'gerente',
    delegation_reason: normalizeDelegationReason(payload.delegation_reason) || 'cliente_sem_vendedor',
    delegationEvent: null
  };
}
function buildTaskPayload(actionPlan = {}) {
  const manager = resolveManager(actionPlan);
  const category = normalizeCategory(actionPlan);
  const title = String(actionPlan.titulo || '').trim() || 'Plano de ação executivo';
  const description = String(actionPlan.descricao || '').trim() || 'Delegação automática gerada pelo Diretor IA.';
  const priority = normalizePriority(actionPlan.impacto, actionPlan.prioridade_score);
  const dueAt = resolveTaskDueDate(priority);
  const metadata = {
    generated_by: 'diretor_delegacao',
    action_plan_status: actionPlan.status || null,
    action_plan_title: actionPlan.titulo || null,
    action_plan_priority_score: Number(actionPlan.prioridade_score || 0),
    action_plan_impact: actionPlan.impacto || null,
    normalized_dedupe_key: dedupeKeyFromRow({ account_id: actionPlan.account_id, action_plan_id: actionPlan.id, manager_id: manager.manager_id, manager_name: manager.manager_name, status: 'open' }),
    criteria_version: 2
  };
  return {
    id: randomUUID(),
    account_id: actionPlan.account_id || null,
    action_plan_id: actionPlan.id,
    manager_id: manager.manager_id,
    manager_name: manager.manager_name,
    gerente: buildLegacyGerenteValue(manager),
    cliente_id: null,
    vendedor_id: null,
    vendedor_name: null,
    delegation_level: 'gerente',
    delegation_reason: null,
    category,
    title,
    titulo: title || 'Tarefa do Diretor IA',
    description,
    descricao: description || '',
    priority,
    prioridade: priority || 'medium',
    status: 'open',
    due_at: dueAt,
    completed_at: null,
    percentual_conclusao: 0,
    metadata,
    created_at: nowIso(),
    updated_at: nowIso()
  };
}
function rowFromPayload(payload = {}) {
  const status = normalizeStatus(payload.status);
  const manager_id = String(payload.manager_id || '').trim() || null;
  const manager_name = normalizeManagerName(payload.manager_name);
  const vendedor_id = String(payload.vendedor_id || '').trim() || null;
  const vendedor_name = normalizeManagerName(payload.vendedor_name);
  const cliente_id = String(payload.cliente_id || '').trim() || null;
  const delegation_level = String(payload.delegation_level || (vendedor_id ? 'vendedor' : 'gerente')).trim() || 'gerente';
  const delegation_reason = normalizeDelegationReason(payload.delegation_reason);
  const origin = String(payload.origin || payload.metadata?.origin || '').trim() || null;
  const row = {
    id: payload.id || randomUUID(),
    account_id: payload.account_id || null,
    action_plan_id: payload.action_plan_id || null,
    manager_id,
    manager_name,
    cliente_id,
    vendedor_id,
    vendedor_name,
    delegation_level,
    delegation_reason,
    category: String(payload.category || payload.categoria || 'geral').trim() || 'geral',
    title: String(payload.title || payload.titulo || '').trim(),
    titulo: String(payload.titulo || payload.title || '').trim() || null,
    description: payload.description ?? payload.descricao ?? null,
    descricao: payload.descricao ?? payload.description ?? null,
    priority: normalizeTaskPriority(payload.priority || payload.prioridade || 'medium'),
    prioridade: normalizeTaskPriority(payload.prioridade || payload.priority || 'medium'),
    status,
    financial_amount: payload.financial_amount ?? null,
    valor: payload.valor ?? null,
    amount: payload.amount ?? null,
    value: payload.value ?? null,
    impacto_estimado: payload.impacto_estimado ?? null,
    monetary_value: payload.monetary_value ?? null,
    due_at: payload.due_at ?? resolveTaskDueDate(payload.priority || payload.prioridade || 'medium'),
    completed_at: payload.completed_at ?? null,
    percentual_conclusao: Math.max(0, Math.min(100, Number(payload.percentual_conclusao ?? 0) || 0)),
    origin,
    metadata: {
      ...(payload.metadata || {}),
      cliente_id,
      vendedor_id,
      vendedor_name,
      delegation_level,
      delegation_reason,
      origin,
      normalized_dedupe_key: payload?.metadata?.normalized_dedupe_key || dedupeKeyFromRow({ account_id: payload.account_id, action_plan_id: payload.action_plan_id, manager_id, manager_name, status })
    },
    criado_em: payload.criado_em || nowIso(),
    created_at: payload.created_at || payload.criado_em || nowIso(),
    updated_at: nowIso()
  };
  if (!row.title) throw new BadRequestError('title obrigatorio');
  return row;
}
function matchesTaskFilter(task, filters = {}) {
  if (filters.status && normalizeStatus(task.status) !== normalizeStatus(filters.status)) return false;
  if (filters.priority && String(task.priority || task.prioridade || '').toLowerCase() !== String(filters.priority).toLowerCase()) return false;
  if (filters.manager_id && String(task.manager_id || '') !== String(filters.manager_id || '')) return false;
  if (filters.manager_name && normalizeManagerName(task.manager_name) !== normalizeManagerName(filters.manager_name)) return false;
  if (filters.vendedor_id && String(task.vendedor_id || task.manager_id || '') !== String(filters.vendedor_id || '')) return false;
  if (filters.cliente_id && String(task.cliente_id || '') !== String(filters.cliente_id || '')) return false;
  if (filters.category && String(task.category || '').toLowerCase() !== String(filters.category).toLowerCase()) return false;
  if (filters.action_plan_id && String(task.action_plan_id || '') !== String(filters.action_plan_id || '')) return false;
  return true;
}
function isOpenOrInProgress(task) {
  return ['open', 'in_progress'].includes(normalizeStatus(task.status));
}
function taskExistingMatch(task, row) {
  return String(task.account_id || '') === String(row.account_id || '') &&
    String(task.action_plan_id || '') === String(row.action_plan_id || '') &&
    String(task.manager_id || '') === String(row.manager_id || '') &&
    normalizeManagerName(task.manager_name) === normalizeManagerName(row.manager_name) &&
    isOpenOrInProgress(task);
}

function taskEquivalentManagerMatch(task, row) {
  const taskManagerKey = normalizeManagerName(task.manager_name) || String(task.manager_id || '').trim() || null;
  const rowManagerKey = normalizeManagerName(row.manager_name) || String(row.manager_id || '').trim() || null;
  if (!taskManagerKey || !rowManagerKey) return false;
  return String(taskManagerKey).toLowerCase() === String(rowManagerKey).toLowerCase();
}

function taskEquivalentVendedorMatch(task, row) {
  return String(task.vendedor_id || '') === String(row.vendedor_id || '') &&
    String(task.cliente_id || '') === String(row.cliente_id || '') &&
    normalizeStatus(task.status) === normalizeStatus(row.status);
}

function taskDelegacaoExistingMatch(task, row) {
  return String(task.account_id || '') === String(row.account_id || '') &&
    String(task.action_plan_id || '') === String(row.action_plan_id || '') &&
    isOpenOrInProgress(task) &&
    (taskEquivalentManagerMatch(task, row) || taskEquivalentVendedorMatch(task, row));
}

function sellerTaskExistingMatch(task, row) {
  return String(task.account_id || '') === String(row.account_id || '') &&
    String(task.cliente_id || '') === String(row.cliente_id || '') &&
    String(task.vendedor_id || '') === String(row.vendedor_id || '') &&
    normalizeSellerTaskReason(task.delegation_reason || task.metadata?.reason) === normalizeSellerTaskReason(row.delegation_reason || row.metadata?.reason) &&
    String(task.status || '').trim().toLowerCase() === 'open';
}

function taskIsTerminal(task) {
  return ['done', 'dismissed'].includes(normalizeStatus(task.status));
}

function actionPlanIsTerminal(actionPlan) {
  return ['concluido', 'cancelado'].includes(String(actionPlan?.status || '').trim().toLowerCase());
}

function observationMatchesActionPlan(observation = {}, actionPlan = {}) {
  const observationMetadata = observation.metadata && typeof observation.metadata === 'object' ? observation.metadata : {};
  const actionPlanMetadata = actionPlan.metadata && typeof actionPlan.metadata === 'object' ? actionPlan.metadata : {};
  const executiveMemoryId = String(actionPlan.executive_memory_id || actionPlanMetadata.executive_memory_id || '').trim();
  const observationExecutiveMemoryId = String(
    observationMetadata.executive_memory_id ||
    observationMetadata.source_executive_memory_id ||
    observation.source_id ||
    observation.source_id ||
    ''
  ).trim();
  return Boolean(executiveMemoryId) && executiveMemoryId === observationExecutiveMemoryId;
}

async function resolveLinkedObservation(accountId, actionPlan) {
  const observations = await listObservations({ accountId }, { status: 'open', limit: 200 }).catch(() => ({ items: [] }));
  return (observations.items || []).find((observation) => observationMatchesActionPlan(observation, actionPlan)) || null;
}

async function closeTaskCycle(accountId, task, conclusionNotes = null, result = null) {
  const actionPlanId = String(task.action_plan_id || '').trim();
  const actionPlanResult = await listActionPlans(accountId, {}, { limit: 200 });
  const actionPlan = (actionPlanResult.items || []).find((plan) => String(plan.id || '').trim() === actionPlanId) || null;
  const taskUpdate = await updateDirectorTaskStatus(task.id, accountId, 'done');
  const relatedTasks = await listDirectorTasks(accountId, { action_plan_id: actionPlanId, limit: 200 });
  const openTasks = (relatedTasks || []).filter((item) => !taskIsTerminal(item));
  let updatedActionPlan = actionPlan;
  let updatedObservation = null;
  let cycleClosed = false;

  if (actionPlan && openTasks.length === 0 && !actionPlanIsTerminal(actionPlan)) {
    updatedActionPlan = await updateActionPlanStatus(actionPlan.id, accountId, 'concluido');
  }

  if (updatedActionPlan) {
    updatedObservation = await resolveLinkedObservation(accountId, updatedActionPlan);
    if (updatedObservation) {
      const observationPlans = await listActionPlansByExecutiveMemoryId(accountId, updatedActionPlan.executive_memory_id);
      const openPlans = (observationPlans.items || []).filter((plan) => String(plan.status || '').trim() !== 'concluido' && String(plan.status || '').trim() !== 'cancelado');
      if (openPlans.length === 0 && String(updatedObservation.status || '').trim() !== 'resolved') {
        updatedObservation = await updateObservationStatus({ accountId }, updatedObservation.id, {
          status: 'resolved',
          metadata: {
            ...(updatedObservation.metadata || {}),
            cycle_closed_at: new Date().toISOString(),
            conclusion_notes: conclusionNotes || null,
            result: result || null,
            task_id: taskUpdate.id,
            action_plan_id: updatedActionPlan.id
          }
        });
        cycleClosed = true;
      }
    }
  }

  logger.info('ai_director_cycle_closed', {
    account_id: accountId,
    task_id: taskUpdate.id,
    action_plan_id: updatedActionPlan?.id || null,
    observation_id: updatedObservation?.id || null,
    cycleClosed
  });
  if (cycleClosed) {
    void createAiDirectorEvent({
      event_type: 'cycle_closed',
      entity_type: 'ciclo',
      entity_id: updatedObservation?.id || updatedActionPlan?.id || taskUpdate.id,
      status: 'resolvido',
      title: updatedObservation?.title || updatedActionPlan?.titulo || taskUpdate.titulo,
      description: 'Ciclo encerrado automaticamente pelo Diretor IA.',
      recurrence_count: 0,
      metadata: { task_id: taskUpdate.id, action_plan_id: updatedActionPlan?.id || null, observation_id: updatedObservation?.id || null }
    }, { accountId }).catch(() => {});
  }

  return {
    task: taskUpdate,
    actionPlan: updatedActionPlan,
    observation: updatedObservation,
    cycleClosed
  };
}

function resolveSupabaseConfigured() { return isSupabaseConfigured(); }
function resolveSupabaseClient() { return getSupabaseClient(); }

async function supportsLegacyGerenteColumn() {
  if (legacyGerenteColumnCache.checked) return legacyGerenteColumnCache.supported;
  try {
    await resolveRepository().many('SELECT gerente FROM ai_director_tasks WHERE account_id = $1 LIMIT 1', ['__probe__']);
    legacyGerenteColumnCache.checked = true;
    legacyGerenteColumnCache.supported = true;
    return true;
  } catch (error) {
    legacyGerenteColumnCache.checked = true;
    legacyGerenteColumnCache.supported = false;
    return false;
  }
}

export async function listOpenActionPlansWithoutTasks(accountId) {
  assertAccountId(accountId);
  const plansResult = await listActionPlans(accountId, { status: 'aberto' }, { limit: 200 });
  const plans = plansResult.items || [];
  const activeTasks = await listDirectorTasks(accountId, {});
  const taskPlanIds = new Set(activeTasks.filter(isOpenOrInProgress).map((task) => String(task.action_plan_id || '').trim()).filter(Boolean));
  return plans.filter((plan) => !taskPlanIds.has(String(plan.id || '').trim()));
}

export async function listOpenActionPlansForDelegation(accountId) {
  assertAccountId(accountId);
  const [openPlans, inProgressPlans] = await Promise.all([
    listActionPlans(accountId, { status: 'aberto' }, { limit: 200 }),
    listActionPlans(accountId, { status: 'em_andamento' }, { limit: 200 })
  ]);
  return [...(openPlans.items || []), ...(inProgressPlans.items || [])];
}

export async function generateDirectorTasksFromOpenActionPlans(accountId) {
  assertAccountId(accountId);
  const actionPlans = await listOpenActionPlansForDelegation(accountId);
  let created = 0;
  let skipped = 0;
  const items = [];
  for (const actionPlan of actionPlans) {
    const row = buildTaskPayload(actionPlan);
    const result = await upsertDirectorTask(row);
    items.push(result.task);
    if (result.skipped) skipped += 1;
    if (result.created) created += 1;
  }
  return { items, created, skipped, total: actionPlans.length };
}

export async function upsertDirectorTask(payload = {}) {
  const accountId = payload.account_id || null;
  assertAccountId(accountId);
  const delegation = await resolveTaskDelegation(payload, { accountId });
  const row = rowFromPayload({ ...payload, ...delegation });
  row.metadata = { ...(row.metadata || {}), normalized_dedupe_key: row.metadata?.normalized_dedupe_key || dedupeKeyFromRow(row) };
  const repo = resolveRepository();

  if (resolveSupabaseConfigured() || repositoryOverride) {
    const legacyGerenteSupported = await supportsLegacyGerenteColumn();
    const dbRow = legacyGerenteSupported ? { ...row, gerente: buildLegacyGerenteValue(row) } : row;
    const currentRows = await repo.many(AiDirectorTasksQueries.listOpenTasksByActionPlan(), [accountId, row.action_plan_id, 200]);
    const current = (currentRows || []).find((task) => taskDelegacaoExistingMatch(task, row)) || null;
    if (current) {
      const updated = await repo.one(AiDirectorTasksQueries.updateTaskById(), [
        accountId,
        current.id,
        dbRow.action_plan_id,
        dbRow.manager_id,
        dbRow.manager_name,
        dbRow.gerente,
        dbRow.cliente_id,
        dbRow.vendedor_id,
        dbRow.vendedor_name,
        dbRow.delegation_level,
        dbRow.delegation_reason,
        dbRow.category,
        dbRow.title,
        dbRow.titulo,
        dbRow.description,
        dbRow.descricao,
        dbRow.priority,
        dbRow.prioridade,
        dbRow.status,
        dbRow.financial_amount,
        dbRow.valor,
        dbRow.amount,
        dbRow.value,
        dbRow.impacto_estimado,
        dbRow.monetary_value,
        dbRow.due_at,
        dbRow.completed_at,
        dbRow.percentual_conclusao,
        dbRow.origin,
        dbRow.metadata,
        nowIso()
      ]);
      await createAiDirectorEvent({ event_type: 'task_created', entity_type: 'tarefa', entity_id: updated.id, status: 'aberto', title: updated.titulo, description: updated.descricao || '', recurrence_count: 0, metadata: { task_id: updated.id, action_plan_id: updated.action_plan_id, manager_id: updated.manager_id } }, { accountId });
      if (delegation.delegationEvent && delegation.vendedor_id) await createAiDirectorEvent(delegation.delegationEvent, { accountId }).catch(() => {});
      return { task: updated, created: false, skipped: true, reason: 'already_exists' };
    }
    const data = await repo.one(AiDirectorTasksQueries.insertTask(), [
      dbRow.id, dbRow.account_id, dbRow.action_plan_id, dbRow.manager_id, dbRow.manager_name, dbRow.gerente, dbRow.cliente_id, dbRow.vendedor_id, dbRow.vendedor_name,
      dbRow.delegation_level, dbRow.delegation_reason, dbRow.category, dbRow.title, dbRow.titulo, dbRow.description, dbRow.descricao, dbRow.priority, dbRow.prioridade,
      dbRow.status, dbRow.financial_amount, dbRow.valor, dbRow.amount, dbRow.value, dbRow.impacto_estimado, dbRow.monetary_value, dbRow.due_at, dbRow.completed_at,
      dbRow.percentual_conclusao, dbRow.origin, dbRow.metadata, dbRow.criado_em, dbRow.created_at, dbRow.updated_at
    ]);
    await createAiDirectorEvent({ event_type: 'task_created', entity_type: 'tarefa', entity_id: data.id, status: 'aberto', title: data.titulo, description: data.descricao || '', recurrence_count: 0, metadata: { task_id: data.id, action_plan_id: data.action_plan_id, manager_id: data.manager_id } }, { accountId });
    if (delegation.delegationEvent && delegation.vendedor_id) await createAiDirectorEvent(delegation.delegationEvent, { accountId }).catch(() => {});
    return { task: data, created: true, skipped: false };
  }

  const current = memoryTasks.find((task) => taskDelegacaoExistingMatch(task, row)) || null;
  if (current) {
    Object.assign(current, row, { id: current.id, criado_em: current.criado_em });
    void createAiDirectorEvent({
      event_type: 'task_created',
      entity_type: 'tarefa',
      entity_id: current.id,
      status: 'aberto',
      title: current.titulo,
      description: current.descricao || '',
      recurrence_count: 0,
      metadata: { task_id: current.id, action_plan_id: current.action_plan_id, manager_id: current.manager_id }
    }, { accountId }).catch(() => {});
    return { task: clone(current), created: false, skipped: true, reason: 'already_exists' };
  }
  memoryTasks.push(row);
  void createAiDirectorEvent({
    event_type: 'task_created',
    entity_type: 'tarefa',
    entity_id: row.id,
    status: 'aberto',
    title: row.titulo,
    description: row.descricao || '',
      recurrence_count: 0,
      metadata: { task_id: row.id, action_plan_id: row.action_plan_id, manager_id: row.manager_id }
    }, { accountId }).catch(() => {});
  if (delegation.delegationEvent && delegation.vendedor_id) {
    void createAiDirectorEvent(delegation.delegationEvent, { accountId }).catch(() => {});
  }
  return { task: clone(row), created: true, skipped: false };
}

export async function upsertSellerInsightTask(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  assertAccountId(accountId);
  const reason = normalizeSellerTaskReason(payload.reason || payload.delegation_reason || payload.metadata?.reason);
  if (!reason) throw new BadRequestError('reason obrigatorio');
  const row = rowFromPayload({
    ...payload,
    account_id: accountId,
    manager_id: payload.manager_id || payload.vendedor_id || null,
    manager_name: payload.manager_name || payload.vendedor_name || null,
    vendedor_id: payload.vendedor_id || null,
    cliente_id: payload.cliente_id || null,
    delegation_level: 'vendedor',
    delegation_reason: reason,
    origin: payload.origin || 'vendedor_ia',
    metadata: {
      ...(payload.metadata || {}),
      origin: payload.origin || 'vendedor_ia',
      reason,
      generated_by: 'vendedor_ia'
    }
  });
  row.origin = payload.origin || 'vendedor_ia';
  row.metadata = { ...(row.metadata || {}), origin: row.origin, reason, generated_by: 'vendedor_ia' };

  if (resolveSupabaseConfigured() || repositoryOverride) {
    const repo = resolveRepository();
    const currentRows = await repo.many(AiDirectorTasksQueries.listOpenSellerTasksByAccount(), [accountId, row.cliente_id, row.vendedor_id, 200]);
    const current = (currentRows || []).find((task) => sellerTaskExistingMatch(task, row)) || null;
    if (current) return { task: current, created: false, skipped: true, reason: 'already_exists' };
    const data = await repo.one(AiDirectorTasksQueries.insertTask(), [
      row.id, row.account_id, row.action_plan_id, row.manager_id, row.manager_name, row.gerente, row.cliente_id, row.vendedor_id, row.vendedor_name,
      row.delegation_level, row.delegation_reason, row.category, row.title, row.titulo, row.description, row.descricao, row.priority, row.prioridade,
      row.status, row.financial_amount, row.valor, row.amount, row.value, row.impacto_estimado, row.monetary_value, row.due_at, row.completed_at,
      row.percentual_conclusao, row.origin, row.metadata, row.criado_em, row.created_at, row.updated_at
    ]);
    await createAiDirectorEvent({
      event_type: 'sales_task_generated',
      entity_type: 'tarefa',
      entity_id: data.id,
      status: 'aberto',
      title: data.titulo,
      description: data.descricao || '',
      recurrence_count: 0,
      metadata: { task_id: data.id, cliente_id: data.cliente_id, vendedor_id: data.vendedor_id, reason }
    }, { accountId });
    return { task: data, created: true, skipped: false };
  }

  const current = memoryTasks.find((task) => sellerTaskExistingMatch(task, row)) || null;
  if (current) return { task: clone(current), created: false, skipped: true, reason: 'already_exists' };
  memoryTasks.push(row);
  void createAiDirectorEvent({
    event_type: 'sales_task_generated',
    entity_type: 'tarefa',
    entity_id: row.id,
    status: 'aberto',
    title: row.titulo,
    description: row.descricao || '',
    recurrence_count: 0,
    metadata: { task_id: row.id, cliente_id: row.cliente_id, vendedor_id: row.vendedor_id, reason }
  }, { accountId }).catch(() => {});
  return { task: clone(row), created: true, skipped: false };
}

export async function listSellerInsightTasks(accountId, filters = {}) {
  assertAccountId(accountId);
  const tasks = await listDirectorTasks(accountId, {
    vendedor_id: filters.vendedor_id || undefined,
    cliente_id: filters.cliente_id || undefined,
    status: filters.status || 'open',
    limit: filters.limit || 200
  });
  return (Array.isArray(tasks) ? tasks : []).filter((task) => String(task.origin || task.metadata?.origin || task.metadata?.generated_by || '') === 'vendedor_ia' || String(task.delegation_reason || task.metadata?.reason || ''));
}

export async function listDirectorTasks(accountId, filters = {}) {
  assertAccountId(accountId);
  const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 25;
  const page = Number(filters.page) > 0 ? Number(filters.page) : 1;
  const normalizedFilters = { ...filters };
  if (normalizedFilters.status) normalizedFilters.status = normalizeStatus(normalizedFilters.status);
  if (normalizedFilters.priority) normalizedFilters.priority = String(normalizedFilters.priority).trim().toLowerCase();
  if (normalizedFilters.category) normalizedFilters.category = String(normalizedFilters.category).trim().toLowerCase();
  if (normalizedFilters.vendedor_id) normalizedFilters.vendedor_id = String(normalizedFilters.vendedor_id).trim();
  if (normalizedFilters.cliente_id) normalizedFilters.cliente_id = String(normalizedFilters.cliente_id).trim();
  if (resolveSupabaseConfigured() || repositoryOverride) {
    const repo = resolveRepository();
    const params = [accountId];
    const where = [];
    if (normalizedFilters.status) { params.push(normalizedFilters.status); where.push(`status = $${params.length}`); }
    if (normalizedFilters.priority) { params.push(normalizedFilters.priority); where.push(`priority = $${params.length}`); }
    if (normalizedFilters.manager_id) { params.push(normalizedFilters.manager_id); where.push(`manager_id = $${params.length}`); }
    if (normalizedFilters.manager_name) { params.push(normalizedFilters.manager_name); where.push(`manager_name = $${params.length}`); }
    if (normalizedFilters.vendedor_id) { params.push(normalizedFilters.vendedor_id); where.push(`vendedor_id = $${params.length}`); }
    if (normalizedFilters.cliente_id) { params.push(normalizedFilters.cliente_id); where.push(`cliente_id = $${params.length}`); }
    if (normalizedFilters.category) { params.push(normalizedFilters.category); where.push(`category = $${params.length}`); }
    if (normalizedFilters.action_plan_id) { params.push(normalizedFilters.action_plan_id); where.push(`action_plan_id = $${params.length}`); }
    params.push(limit, (page - 1) * limit);
    const rows = await repo.many(AiDirectorTasksQueries.listTasks(where.join(' AND ')), params);
    const items = rows || [];
    items.page = page;
    items.limit = limit;
    items.total = items.length;
    return items;
  }
  const items = memoryTasks
    .filter((task) => task.account_id === accountId)
    .filter((task) => matchesTaskFilter(task, normalizedFilters))
    .map(clone)
    .sort((a, b) => new Date(b.updated_at || b.criado_em || 0).getTime() - new Date(a.updated_at || a.criado_em || 0).getTime());
  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);
  pageItems.page = page;
  pageItems.limit = limit;
  pageItems.total = items.length;
  return pageItems;
}

export function isDirectorTaskOverdue(task, referenceTime = Date.now()) {
  if (!task?.due_at) return false;
  const dueTime = new Date(task.due_at).getTime();
  if (Number.isNaN(dueTime)) return false;
  return dueTime < referenceTime && !['done', 'dismissed'].includes(normalizeStatus(task.status));
}

export function getDirectorTaskRemainingDays(task, referenceTime = Date.now()) {
  if (!task?.due_at) return null;
  const dueTime = new Date(task.due_at).getTime();
  if (Number.isNaN(dueTime)) return null;
  return Math.ceil((dueTime - referenceTime) / (24 * 60 * 60 * 1000));
}

export async function updateDirectorTaskStatus(id, accountId, status) {
  assertAccountId(accountId);
  const rawStatus = String(status || '').trim().toLowerCase();
  if (!validStatus.has(rawStatus)) throw new BadRequestError('status invalido');
  const normalizedStatus = rawStatus;
  if (resolveSupabaseConfigured() || repositoryOverride) {
    const repo = resolveRepository();
    const current = await repo.one(AiDirectorTasksQueries.getTaskById(), [accountId, id]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') throw new NotFoundError('Tarefa nao encontrada', { domain: 'ai-director-tasks' });
      throw error;
    });
    const percentual = normalizedStatus === 'done' ? 100 : current.percentual_conclusao;
    const completionFields = normalizedStatus === 'done' ? { completed_at: current.completed_at || nowIso() } : {};
    const data = await repo.one(AiDirectorTasksQueries.updateTaskStatus(), [accountId, id, normalizedStatus, percentual, completionFields.completed_at || null, nowIso()]);
    if (normalizedStatus === 'done') {
      await createAiDirectorEvent({
        event_type: 'task_completed',
        entity_type: 'tarefa',
        entity_id: data.id,
        status: 'resolvido',
        title: data.titulo,
        description: data.descricao || '',
        recurrence_count: 0,
        metadata: { task_id: data.id, action_plan_id: data.action_plan_id, manager_id: data.manager_id }
      }, { accountId });
    }
    return data;
  }
  const current = memoryTasks.find((task) => String(task.id) === String(id) && task.account_id === accountId) || null;
  if (!current) throw new NotFoundError('Tarefa nao encontrada', { domain: 'ai-director-tasks' });
  current.status = normalizedStatus;
  current.percentual_conclusao = current.status === 'done' ? 100 : current.percentual_conclusao;
  current.completed_at = normalizedStatus === 'done' ? (current.completed_at || nowIso()) : current.completed_at;
  current.updated_at = nowIso();
  current.updated_at = current.updated_at || nowIso();
  if (normalizedStatus === 'done') {
    void createAiDirectorEvent({
      event_type: 'task_completed',
      entity_type: 'tarefa',
      entity_id: current.id,
      status: 'resolvido',
      title: current.titulo,
      description: current.descricao || '',
      recurrence_count: 0,
      metadata: { task_id: current.id, action_plan_id: current.action_plan_id, manager_id: current.manager_id }
    }, { accountId }).catch(() => {});
  }
  return clone(current);
}

export async function completeDirectorTask(accountId, id, payload = {}) {
  assertAccountId(accountId);
  const tasks = await listDirectorTasks(accountId, { limit: 200 });
  const current = (tasks || []).find((task) => String(task.id) === String(id) && task.account_id === accountId) || null;
  if (!current) throw new NotFoundError('Tarefa nao encontrada', { domain: 'ai-director-tasks' });
  return closeTaskCycle(accountId, current, payload.conclusion_notes || null, payload.result || null);
}

export function __resetMemoryAiDirectorTasksForTests() {
  memoryTasks.length = 0;
  repositoryOverride = null;
  legacyGerenteColumnCache.checked = false;
  legacyGerenteColumnCache.supported = false;
}

export function __setAiDirectorTasksDatabaseForTests(adapter) {
  repositoryOverride = adapter instanceof AiDirectorTasksRepository ? adapter : new AiDirectorTasksRepository(adapter);
}
