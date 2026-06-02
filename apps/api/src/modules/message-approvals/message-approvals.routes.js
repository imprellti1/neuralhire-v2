import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requirePermission, requireRole } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import { approveMessageDraftHandler, getMessageApprovalByDraftHandler, getMessageApprovalHandler, listMessageApprovalsHandler, listPendingMessageApprovalsHandler, rejectMessageDraftHandler } from './message-approvals.controller.js';

export function registerMessageApprovalsRoutes(router) {
  const readMiddlewares = [requirePermission('followup:read'), requireTenant({ domain: 'message-approvals' })];
  const writeMiddlewares = [requireRole('manager'), requireTenant({ domain: 'message-approvals' })];
  router.registerRoute({ method: 'GET', path: '/message-approvals/pending', domain: 'message-approvals', middlewares: readMiddlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await listPendingMessageApprovalsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/message-approvals', domain: 'message-approvals', middlewares: readMiddlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await listMessageApprovalsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/message-approvals/:approvalId', domain: 'message-approvals', middlewares: readMiddlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getMessageApprovalHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/message-approvals/draft/:draftId', domain: 'message-approvals', middlewares: readMiddlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await getMessageApprovalByDraftHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/message-approvals/:draftId/approve', domain: 'message-approvals', middlewares: writeMiddlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await approveMessageDraftHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/message-approvals/:draftId/reject', domain: 'message-approvals', middlewares: writeMiddlewares, handler: asyncHandler(async (_, res, context) => sendSuccess(res, await rejectMessageDraftHandler(context))) });
}
