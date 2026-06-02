import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requirePermission } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import { getApprovalIntelligenceActionsHandler, getApprovalIntelligenceDashboardHandler, getApprovalIntelligenceReasonsHandler, getApprovalIntelligenceTrendsHandler } from './approval-intelligence.controller.js';

export function registerApprovalIntelligenceRoutes(router) {
  const middlewares = [requirePermission('followup:read'), requireTenant({ domain: 'approval-intelligence' })];
  router.registerRoute({ method: 'GET', path: '/approval-intelligence/dashboard', domain: 'approval-intelligence', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getApprovalIntelligenceDashboardHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/approval-intelligence/trends', domain: 'approval-intelligence', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getApprovalIntelligenceTrendsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/approval-intelligence/reasons', domain: 'approval-intelligence', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getApprovalIntelligenceReasonsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/approval-intelligence/actions', domain: 'approval-intelligence', middlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getApprovalIntelligenceActionsHandler(context))) });
}

