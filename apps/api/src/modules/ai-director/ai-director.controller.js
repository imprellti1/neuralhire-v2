import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { listAiDirectorEvents } from './ai-director-events.repository.js';
import { createAiDirectorMemory, consultManager, getAiDirectorDashboard, listAiDirectorMemories, listExecutiveMemories, listManagers } from './ai-director.repository.js';
import { listActionPlans, updateActionPlanStatus } from './ai-director-action-plans.repository.js';
import { completeDirectorTask, listDirectorTasks, updateDirectorTaskStatus } from './ai-director-tasks.repository.js';
import { answerAiDirectorQuestion, delegateAiDirectorQuestion } from './ai-director.orchestrator.js';

export async function getAiDirectorDashboardHandler() {
  return { ok: true, ...(await getAiDirectorDashboard()) };
}

export async function listAiDirectorMemoriesHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const limit = context?.query?.limit !== undefined ? Number(context.query.limit) : undefined;
  return { ok: true, ...(await listAiDirectorMemories({ limit }, { accountId, context })) };
}

export async function listAiDirectorExecutiveMemoriesHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const limit = context?.query?.limit !== undefined ? Number(context.query.limit) : undefined;
  const categoria = context?.query?.categoria ? String(context.query.categoria).trim() : undefined;
  return { ok: true, ...(await listExecutiveMemories({ limit, categoria }, { accountId, context })) };
}

export async function createAiDirectorMemoryHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id;
  delete body.accountId;
  const item = await createAiDirectorMemory(body, { accountId, context });
  return { ok: true, item };
}

export async function listAiDirectorManagersHandler(context = {}) {
  getAccountIdFromContext(context);
  return { ok: true, managers: listManagers() };
}

export async function consultAiDirectorManagerHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const managerId = context?.params?.id;
  const body = { ...(context.body || {}) };
  const result = consultManager({ accountId, context }, managerId, body);
  return { ok: true, ...result };
}

export async function delegateAiDirectorQuestionHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  const result = await delegateAiDirectorQuestion(body, { accountId, context });
  return { ok: true, ...result };
}

export async function askAiDirectorQuestionHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  const result = await answerAiDirectorQuestion(body, { accountId, context });
  return { ok: true, ...result };
}

export async function listAiDirectorActionPlansHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const status = context?.query?.status ? String(context.query.status).trim() : undefined;
  const gerenteResponsavel = context?.query?.gerente_responsavel ? String(context.query.gerente_responsavel).trim() : undefined;
  return { ok: true, ...(await listActionPlans(accountId, { status, gerente_responsavel: gerenteResponsavel })) };
}

export async function patchAiDirectorActionPlanStatusHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = context?.params?.id;
  const status = String(context?.body?.status || '').trim();
  return { ok: true, item: await updateActionPlanStatus(id, accountId, status) };
}

export async function listAiDirectorTasksHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  const items = await listDirectorTasks(accountId, {
    status: query.status ? String(query.status).trim() : undefined,
    priority: query.priority ? String(query.priority).trim() : undefined,
    manager_id: query.manager_id ? String(query.manager_id).trim() : query.gerente ? String(query.gerente).trim() : undefined,
    manager_name: query.manager_name ? String(query.manager_name).trim() : undefined,
    category: query.category ? String(query.category).trim() : undefined,
    action_plan_id: query.action_plan_id ? String(query.action_plan_id).trim() : undefined,
    limit: query.limit,
    page: query.page
  });
  return { ok: true, items, page: items.page, limit: items.limit, total: items.total };
}

export async function patchAiDirectorTaskStatusHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = context?.params?.id;
  const status = String(context?.body?.status || '').trim();
  return { ok: true, item: await updateDirectorTaskStatus(id, accountId, status) };
}

export async function completeAiDirectorTaskHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = context?.params?.id;
  const body = { ...(context.body || {}) };
  const result = await completeDirectorTask(accountId, id, body);
  return { ok: true, ...result };
}

export async function listAiDirectorEventsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  const result = await listAiDirectorEvents(accountId, {
    status: query.status ? String(query.status).trim() : undefined,
    event_type: query.event_type ? String(query.event_type).trim() : undefined,
    entity_type: query.entity_type ? String(query.entity_type).trim() : undefined,
    entity_id: query.entity_id ? String(query.entity_id).trim() : undefined,
    origin: query.origin ? String(query.origin).trim() : undefined,
    category: query.category ? String(query.category).trim() : undefined,
    limit: query.limit,
    offset: query.offset
  });
  const items = result.items || [];
  const closedCycles = items.filter((item) => item.event_type === 'cycle_closed').length;
  const reopenedCycles = items.filter((item) => item.event_type === 'cycle_reopened' || item.event_type === 'observation_reopened').length;
  const resolved = items.filter((item) => item.status === 'resolvido' || item.event_type === 'observation_resolved' || item.event_type === 'task_completed' || item.event_type === 'action_plan_completed');
  const avgResolutionHours = resolved.length
    ? resolved.reduce((sum, item) => sum + Math.max(0, (new Date(item.updated_at || item.created_at).getTime() - new Date(item.created_at).getTime()) / 36e5), 0) / resolved.length
    : 0;
  const recurring = [...items].sort((a, b) => Number(b.recurrence_count || 0) - Number(a.recurrence_count || 0)).slice(0, 10);
  return { ok: true, items, total: result.total, kpis: { closedCycles, reopenedCycles, avgResolutionHours, recurring } };
}
