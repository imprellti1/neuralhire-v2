import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requirePermission } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import { getAuditLog, getAuditLogs } from './audit-logs.controller.js';

export function registerAuditLogsRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/audit-logs', domain: 'system-audit', middlewares: [requireTenant, requirePermission('system:admin')], handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAuditLogs(context))) });
  router.registerRoute({ method: 'GET', path: '/audit-logs/:id', domain: 'system-audit', middlewares: [requireTenant, requirePermission('system:admin')], handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAuditLog(context))) });
}
