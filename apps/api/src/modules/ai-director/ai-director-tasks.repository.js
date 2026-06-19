import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { listActionPlans, listActionPlansByExecutiveMemoryId, updateActionPlanStatus } from './ai-director-action-plans.repository.js';
import { listObservations, updateObservationStatus } from '../ai-director-observations/ai-director-observations.repository.js';
import { getManagerById } from './ai-director.repository.js';

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
const memoryTasks = [];
const legacyGerenteColumnCache = { checked: false, supported: false };

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-tasks' });
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
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
function buildTaskPayload(actionPlan = {}) {
  const manager = resolveManager(actionPlan);
  const category = normalizeCategory(actionPlan);
  const title = String(actionPlan.titulo || '').trim() || 'Plano de ação executivo';
  const description = String(actionPlan.descricao || '').trim() || 'Delegação automática gerada pelo Diretor IA.';
  const priority = normalizePriority(actionPlan.impacto, actionPlan.prioridade_score);
  const dueAt = actionPlan.prazo_dias ? new Date(Date.now() + Number(actionPlan.prazo_dias) * 24 * 60 * 60 * 1000).toISOString() : null;
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
    category,
    title,
    titulo: title || 'Tarefa do Diretor IA',
    description,
    descricao: description || '',
    priority,
    prioridade: priority || 'medium',
    status: 'open',
    due_at: dueAt,
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
  const row = {
    id: payload.id || randomUUID(),
    account_id: payload.account_id || null,
    action_plan_id: payload.action_plan_id || null,
    manager_id,
    manager_name,
    category: String(payload.category || payload.categoria || 'geral').trim() || 'geral',
    title: String(payload.title || payload.titulo || '').trim(),
    titulo: String(payload.titulo || payload.title || '').trim() || null,
    description: payload.description ?? payload.descricao ?? null,
    descricao: payload.descricao ?? payload.description ?? null,
    priority: String(payload.priority || payload.prioridade || 'medium').trim() || 'medium',
    prioridade: String(payload.prioridade || payload.priority || 'medium').trim() || 'medium',
    status,
    due_at: payload.due_at ?? null,
    percentual_conclusao: Math.max(0, Math.min(100, Number(payload.percentual_conclusao ?? 0) || 0)),
    metadata: { ...(payload.metadata || {}), normalized_dedupe_key: payload?.metadata?.normalized_dedupe_key || dedupeKeyFromRow({ account_id: payload.account_id, action_plan_id: payload.action_plan_id, manager_id, manager_name, status }) },
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

function taskDelegacaoExistingMatch(task, row) {
  return String(task.account_id || '') === String(row.account_id || '') &&
    String(task.action_plan_id || '') === String(row.action_plan_id || '') &&
    isOpenOrInProgress(task) &&
    taskEquivalentManagerMatch(task, row);
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

  return {
    task: taskUpdate,
    actionPlan: updatedActionPlan,
    observation: updatedObservation,
    cycleClosed
  };
}

function resolveSupabaseConfigured() { return isSupabaseConfigured(); }
function resolveSupabaseClient() { return getSupabaseClient(); }

async function listTasksSupabase(accountId, filters = {}) {
  const supabase = resolveSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 25;
  const page = Number(filters.page) > 0 ? Number(filters.page) : 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = supabase.from('ai_director_tasks').select('*', { count: 'exact' }).eq('account_id', accountId).order('updated_at', { ascending: false }).range(from, to);
  if (filters.status) query = query.eq('status', normalizeStatus(filters.status));
  if (filters.priority) query = query.eq('priority', String(filters.priority).toLowerCase());
  if (filters.manager_id) query = query.eq('manager_id', filters.manager_id);
  if (filters.manager_name) query = query.eq('manager_name', filters.manager_name);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.action_plan_id) query = query.eq('action_plan_id', filters.action_plan_id);
  const { data, error } = await query;
  if (error) throw new DatabaseError('Falha ao listar tarefas', { details: error });
  const items = data || [];
  items.page = page;
  items.limit = limit;
  items.total = data?.length || 0;
  return items;
}

async function supportsLegacyGerenteColumn() {
  if (legacyGerenteColumnCache.checked) return legacyGerenteColumnCache.supported;
  const supabase = resolveSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase.from('ai_director_tasks').select('gerente').limit(1);
  legacyGerenteColumnCache.checked = true;
  legacyGerenteColumnCache.supported = !error;
  return legacyGerenteColumnCache.supported;
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
  const row = rowFromPayload(payload);
  row.metadata = { ...(row.metadata || {}), normalized_dedupe_key: row.metadata?.normalized_dedupe_key || dedupeKeyFromRow(row) };

  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const legacyGerenteSupported = await supportsLegacyGerenteColumn();
    const dbRow = legacyGerenteSupported ? { ...row, gerente: buildLegacyGerenteValue(row) } : row;
    const { data: currentRows, error: currentError } = await supabase
      .from('ai_director_tasks')
      .select('*')
      .eq('account_id', accountId)
      .eq('action_plan_id', row.action_plan_id)
      .in('status', ['open', 'in_progress'])
      .order('updated_at', { ascending: false });
    if (currentError) throw new DatabaseError('Falha ao consultar tarefa', { details: currentError });
    const current = (currentRows || []).find((task) => taskDelegacaoExistingMatch(task, row)) || null;
    if (current) {
      const { data, error } = await supabase.from('ai_director_tasks').update({ ...dbRow, id: current.id, criado_em: current.criado_em }).eq('id', current.id).select('*').single();
      if (error) throw new DatabaseError('Falha ao atualizar tarefa', { details: error });
      return { task: data, created: false, skipped: true, reason: 'already_exists' };
    }
    const { data, error } = await supabase.from('ai_director_tasks').insert(dbRow).select('*').single();
    if (!error && data) return { task: data, created: true, skipped: false };
    if (error?.code === '23505') {
      const { data: duplicateRows, error: duplicateError } = await supabase
        .from('ai_director_tasks')
        .select('*')
        .eq('account_id', accountId)
        .eq('action_plan_id', row.action_plan_id)
        .in('status', ['open', 'in_progress'])
        .order('updated_at', { ascending: false });
      if (duplicateError) throw new DatabaseError('Falha ao consultar tarefa existente', { details: duplicateError });
      const duplicate = (duplicateRows || []).find((task) => taskDelegacaoExistingMatch(task, row)) || null;
      if (duplicate) return { task: duplicate, created: false, skipped: true, reason: 'already_exists' };
    }
    throw new DatabaseError('Falha ao criar tarefa', { details: error });
  }

  const current = memoryTasks.find((task) => taskDelegacaoExistingMatch(task, row)) || null;
  if (current) {
    Object.assign(current, row, { id: current.id, criado_em: current.criado_em });
    return { task: clone(current), created: false, skipped: true, reason: 'already_exists' };
  }
  memoryTasks.push(row);
  return { task: clone(row), created: true, skipped: false };
}

export async function listDirectorTasks(accountId, filters = {}) {
  assertAccountId(accountId);
  const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 25;
  const page = Number(filters.page) > 0 ? Number(filters.page) : 1;
  const normalizedFilters = { ...filters };
  if (normalizedFilters.status) normalizedFilters.status = normalizeStatus(normalizedFilters.status);
  if (normalizedFilters.priority) normalizedFilters.priority = String(normalizedFilters.priority).trim().toLowerCase();
  if (normalizedFilters.category) normalizedFilters.category = String(normalizedFilters.category).trim().toLowerCase();
  if (resolveSupabaseConfigured()) return listTasksSupabase(accountId, normalizedFilters);
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

export async function updateDirectorTaskStatus(id, accountId, status) {
  assertAccountId(accountId);
  const rawStatus = String(status || '').trim().toLowerCase();
  if (!validStatus.has(rawStatus)) throw new BadRequestError('status invalido');
  const normalizedStatus = rawStatus;
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: current, error } = await supabase.from('ai_director_tasks').select('*').eq('id', id).eq('account_id', accountId).maybeSingle();
    if (error) throw new DatabaseError('Falha ao consultar tarefa', { details: error });
    if (!current) throw new NotFoundError('Tarefa nao encontrada', { domain: 'ai-director-tasks' });
    const percentual = normalizedStatus === 'done' ? 100 : current.percentual_conclusao;
    const { data, error: updateError } = await supabase.from('ai_director_tasks').update({ status: normalizedStatus, percentual_conclusao: percentual, updated_at: nowIso() }).eq('id', id).eq('account_id', accountId).select('*').single();
    if (updateError) throw new DatabaseError('Falha ao atualizar tarefa', { details: updateError });
    return data;
  }
  const current = memoryTasks.find((task) => String(task.id) === String(id) && task.account_id === accountId) || null;
  if (!current) throw new NotFoundError('Tarefa nao encontrada', { domain: 'ai-director-tasks' });
  current.status = normalizedStatus;
  current.percentual_conclusao = current.status === 'done' ? 100 : current.percentual_conclusao;
  current.updated_at = nowIso();
  current.updated_at = current.updated_at || nowIso();
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
}
