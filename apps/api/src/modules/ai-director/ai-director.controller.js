import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { createAiDirectorMemory, consultManager, getAiDirectorDashboard, listAiDirectorMemories, listExecutiveMemories, listManagers } from './ai-director.repository.js';
import { listActionPlans, updateActionPlanStatus } from './ai-director-action-plans.repository.js';
import { listDirectorTasks, updateDirectorTaskStatus } from './ai-director-tasks.repository.js';
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
  return {
    ok: true,
    items: await listDirectorTasks(accountId, {
      status: query.status ? String(query.status).trim() : undefined,
      gerente: query.gerente ? String(query.gerente).trim() : undefined,
      action_plan_id: query.action_plan_id ? String(query.action_plan_id).trim() : undefined
    })
  };
}

export async function patchAiDirectorTaskStatusHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = context?.params?.id;
  const status = String(context?.body?.status || '').trim();
  return { ok: true, item: await updateDirectorTaskStatus(id, accountId, status) };
}
