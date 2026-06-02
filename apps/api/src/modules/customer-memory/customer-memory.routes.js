import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getCustomerMemoryHandler, getCustomerMemorySummaryHandler, rebuildCustomerMemoryHandler } from './customer-memory.controller.js';

export function registerCustomerMemoryRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/accounts/:accountId/customer-memory/:clienteId', domain: 'customer-success', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await getCustomerMemoryHandler(ctx))) });
  router.registerRoute({ method: 'GET', path: '/accounts/:accountId/customer-memory/:clienteId/summary', domain: 'customer-success', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await getCustomerMemorySummaryHandler(ctx))) });
  router.registerRoute({ method: 'POST', path: '/accounts/:accountId/customer-memory/:clienteId/rebuild', domain: 'customer-success', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await rebuildCustomerMemoryHandler(ctx))) });
  router.registerRoute({ method: 'POST', path: '/customer-memory/:clienteId/rebuild', domain: 'customer-success', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await rebuildCustomerMemoryHandler(ctx))) });
}
