import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { createAiDirectorMemory, getAiDirectorDashboard, listAiDirectorMemories } from './ai-director.repository.js';

export async function getAiDirectorDashboardHandler() {
  return { ok: true, ...getAiDirectorDashboard() };
}

export async function listAiDirectorMemoriesHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const limit = context?.query?.limit !== undefined ? Number(context.query.limit) : undefined;
  return { ok: true, ...(await listAiDirectorMemories({ limit }, { accountId, context })) };
}

export async function createAiDirectorMemoryHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id;
  delete body.accountId;
  const item = await createAiDirectorMemory(body, { accountId, context });
  return { ok: true, item };
}
