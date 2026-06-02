import { getCustomerMemory, getCustomerMemorySummary, rebuildCustomerMemory } from './customer-memory.repository.js';

export async function getCustomerMemoryHandler(ctx) {
  return getCustomerMemory(ctx.params.clienteId, { accountId: ctx.params.accountId, context: ctx });
}

export async function getCustomerMemorySummaryHandler(ctx) {
  return getCustomerMemorySummary(ctx.params.clienteId, { accountId: ctx.params.accountId, context: ctx });
}

export async function rebuildCustomerMemoryHandler(ctx) {
  return rebuildCustomerMemory(ctx.params.clienteId, { accountId: ctx.params.accountId || ctx.auth?.accountId, context: ctx });
}
