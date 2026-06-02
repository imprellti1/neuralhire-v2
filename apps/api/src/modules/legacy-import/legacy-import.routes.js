import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requireRole } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import {
  executeLegacyImportHandler,
  approveLegacyImportBatchHandler,
  getLegacyImportBatchHandler,
  getLegacyImportBatchIssuesHandler,
  getLegacyImportBatchRecordsHandler,
  getLegacyImportStatusHandler,
  listLegacyImportBatchesHandler,
  rejectLegacyImportBatchHandler,
  promoteLegacyImportBatchHandler,
  auditLegacyImportBatchHandler,
  getLegacyImportBatchReportHandler,
  previewLegacyImportHandler,
  validateLegacyImportHandler
} from './legacy-import.controller.js';

export function registerLegacyImportRoutes(router) {
  const middlewares = [requireRole('manager'), requireTenant({ domain: 'legacy-import' })];

  router.registerRoute({ method: 'GET', path: '/legacy-import/status', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getLegacyImportStatusHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/legacy-import/batches', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await listLegacyImportBatchesHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/legacy-import/batches/:batchId', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getLegacyImportBatchHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/legacy-import/batches/:batchId/records', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getLegacyImportBatchRecordsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/legacy-import/batches/:batchId/issues', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getLegacyImportBatchIssuesHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/legacy-import/batches/:batchId/approve', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await approveLegacyImportBatchHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/legacy-import/batches/:batchId/reject', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await rejectLegacyImportBatchHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/legacy-import/batches/:batchId/promote', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await promoteLegacyImportBatchHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/legacy-import/batches/:batchId/audit', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await auditLegacyImportBatchHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/legacy-import/batches/:batchId/report', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getLegacyImportBatchReportHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/legacy-import/preview', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await previewLegacyImportHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/legacy-import/validate', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await validateLegacyImportHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/legacy-import/execute', domain: 'legacy-import', middlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await executeLegacyImportHandler(context))) });
}
