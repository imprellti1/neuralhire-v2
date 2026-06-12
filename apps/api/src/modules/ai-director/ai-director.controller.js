import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { createAiDirectorMemory, consultManager, getAiDirectorDashboard, listAiDirectorMemories, listExecutiveMemories, listManagers } from './ai-director.repository.js';
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
