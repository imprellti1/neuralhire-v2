import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { listActionPlans } from './ai-director-action-plans.repository.js';
import { getManagerById } from './ai-director.repository.js';

const validStatus = new Set(['open', 'in_progress', 'done', 'blocked', 'cancelled']);
const validLegacyStatus = new Map([
  ['aberto', 'open'],
  ['em_andamento', 'in_progress'],
  ['concluido', 'done'],
  ['bloqueado', 'blocked'],
  ['cancelado', 'cancelled']
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
function normalizeStatusList(status) {
  const normalized = normalizeStatus(status);
  return normalized;
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
    description,
    priority,
    status: 'open',
    due_at: dueAt,
    percentual_conclusao: 0,
    metadata
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
    description: payload.description ?? payload.descricao ?? null,
    priority: String(payload.priority || payload.prioridade || 'medium').trim() || 'medium',
    status,
    due_at: payload.due_at ?? null,
    percentual_conclusao: Math.max(0, Math.min(100, Number(payload.percentual_conclusao ?? 0) || 0)),
    metadata: { ...(payload.metadata || {}), normalized_dedupe_key: payload?.metadata?.normalized_dedupe_key || dedupeKeyFromRow({ account_id: payload.account_id, action_plan_id: payload.action_plan_id, manager_id, manager_name, status }) },
    criado_em: payload.criado_em || nowIso(),
    updated_at: nowIso()
  };
  if (!row.title) throw new BadRequestError('title obrigatorio');
  return row;
}
function matchesTaskFilter(task, filters = {}) {
  if (filters.status && normalizeStatus(task.status) !== normalizeStatus(filters.status)) return false;
  if (filters.manager_id && String(task.manager_id || '') !== String(filters.manager_id || '')) return false;
  if (filters.manager_name && normalizeManagerName(task.manager_name) !== normalizeManagerName(filters.manager_name)) return false;
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

function resolveSupabaseConfigured() { return isSupabaseConfigured(); }
function resolveSupabaseClient() { return getSupabaseClient(); }

async function listTasksSupabase(accountId, filters = {}) {
  const supabase = resolveSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  let query = supabase.from('ai_director_tasks').select('*').eq('account_id', accountId).order('updated_at', { ascending: false });
  if (filters.status) query = query.eq('status', normalizeStatus(filters.status));
  if (filters.manager_id) query = query.eq('manager_id', filters.manager_id);
  if (filters.manager_name) query = query.eq('manager_name', filters.manager_name);
  if (filters.action_plan_id) query = query.eq('action_plan_id', filters.action_plan_id);
  const { data, error } = await query;
  if (error) throw new DatabaseError('Falha ao listar tarefas', { details: error });
  return data || [];
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
    const existing = await listDirectorTasks(accountId, { action_plan_id: actionPlan.id });
    const existedBefore = existing.some(isOpenOrInProgress);
    const result = await upsertDirectorTask(row);
    items.push(result);
    if (existedBefore) skipped += 1;
    else created += 1;
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
    const current = (currentRows || []).find((task) => taskExistingMatch(task, row)) || null;
    if (current) {
      const { data, error } = await supabase.from('ai_director_tasks').update({ ...dbRow, id: current.id, criado_em: current.criado_em }).eq('id', current.id).select('*').single();
      if (error) throw new DatabaseError('Falha ao atualizar tarefa', { details: error });
      return data;
    }
    const { data, error } = await supabase.from('ai_director_tasks').insert(dbRow).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar tarefa', { details: error });
    return data;
  }

  const current = memoryTasks.find((task) => taskExistingMatch(task, row)) || null;
  if (current) {
    Object.assign(current, row, { id: current.id, criado_em: current.criado_em });
    return clone(current);
  }
  memoryTasks.push(row);
  return clone(row);
}

export async function listDirectorTasks(accountId, filters = {}) {
  assertAccountId(accountId);
  if (resolveSupabaseConfigured()) return listTasksSupabase(accountId, filters);
  return memoryTasks
    .filter((task) => task.account_id === accountId)
    .filter((task) => matchesTaskFilter(task, filters))
    .map(clone)
    .sort((a, b) => new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime());
}

export async function updateDirectorTaskStatus(id, accountId, status) {
  assertAccountId(accountId);
  const normalizedStatus = normalizeStatus(status);
  if (!validStatus.has(normalizedStatus)) throw new BadRequestError('status invalido');
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
  return clone(current);
}

export function __resetMemoryAiDirectorTasksForTests() {
  memoryTasks.length = 0;
}
