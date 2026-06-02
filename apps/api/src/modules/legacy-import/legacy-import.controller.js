import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { ValidationError } from '../../core/errors.js';
import { buildLegacyExecuteSummary, buildLegacyImportSummary } from './legacy-import.mapper.js';
import { ensureLegacyImportPayload, validateAndNormalizeLegacyPayload } from './legacy-import.validator.js';
import {
  approveBatch,
  addIssue,
  addRecord,
  createBatch,
  getBatch,
  getBatchSummary,
  getBatchIssues,
  getBatchRecords,
  listBatches,
  rejectBatch,
  updateRecordStatus,
  updateBatchStatus,
  updateBatchSummary
} from './legacy-import-staging.repository.js';
import { promoteLegacyImportBatch } from './legacy-import-promoter.js';
import { auditPromotion, buildPromotionReport } from './legacy-import-auditor.js';
import { getLegacyImportStatus } from './legacy-import.repository.js';
import { env } from '../../config/env.js';

function assertContextAccount(context) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) throw new ValidationError('Contexto de tenant obrigatorio', { domain: 'legacy-import' });
  return accountId;
}

function assertLegacyImportAllowed() {
  const runtimeEnv = process.env.NODE_ENV || env.NODE_ENV;
  if (runtimeEnv === 'production') {
    throw new ValidationError('Importacao bloqueada em producao', { domain: 'legacy-import' });
  }
}

export async function getLegacyImportStatusHandler(context = {}) {
  assertContextAccount(context);
  const status = getLegacyImportStatus(context);
  return { enabled: status.enabled, environment: status.environment, stagingEnabled: true, stagingTables: ['legacy_import_batches', 'legacy_import_records', 'legacy_import_issues'], supportedEntities: ['clientes', 'produtos', 'pedidos', 'pedidoItens', 'fabricantes', 'vendedores'], mode: status.mode, warnings: status.warnings };
}

export async function validateLegacyImportHandler(context = {}) {
  assertContextAccount(context);
  assertLegacyImportAllowed();
  const payload = ensureLegacyImportPayload(context.body || {});
  const result = validateAndNormalizeLegacyPayload(payload);
  const accountId = assertContextAccount(context);
  const batch = await createBatch({ source: String(payload.source || 'legacy-import'), status: 'validating', dry_run: true, summary: buildLegacyImportSummary(result.normalized, result.duplicates, result.issues) }, { accountId });
  for (const entity of Object.keys(result.normalized)) {
    for (const [index, record] of result.normalized[entity].entries()) {
      const issues = result.issues.filter((issue) => issue.entity === entity && issue.index === index);
      const persistedRecord = await addRecord({ batch_id: batch.id, entity, status: issues.some((issue) => issue.code !== 'DUPLICATE') ? 'received' : 'validated', raw_payload: payload?.data?.[entity]?.[index] || {}, normalized_payload: record, issues_count: issues.length }, { accountId });
      for (const issue of issues) {
        await addIssue({ batch_id: batch.id, record_id: persistedRecord.id, entity: issue.entity, field: issue.field, code: issue.code, message: issue.message, severity: issue.code === 'DUPLICATE' ? 'warning' : 'error' }, { accountId });
      }
      await updateBatchStatus(batch.id, 'validating', { accountId });
    }
  }
  await updateBatchStatus(batch.id, 'validated', { accountId });
  await updateBatchSummary(batch.id, buildLegacyImportSummary(result.normalized, result.duplicates, result.issues), { accountId });
  return { batchId: batch.id, ok: result.issues.length === 0, issues: result.issues, normalized: result.normalized };
}

export async function previewLegacyImportHandler(context = {}) {
  assertContextAccount(context);
  assertLegacyImportAllowed();
  const payload = ensureLegacyImportPayload(context.body || {});
  const result = validateAndNormalizeLegacyPayload(payload);
  const accountId = assertContextAccount(context);
  const batch = await createBatch({ source: String(payload.source || 'legacy-import'), status: 'validating', dry_run: true, summary: buildLegacyImportSummary(result.normalized, result.duplicates, result.issues) }, { accountId });
  for (const entity of Object.keys(result.normalized)) {
    for (const [index, record] of result.normalized[entity].entries()) {
      const issues = result.issues.filter((issue) => issue.entity === entity && issue.index === index);
      const persistedRecord = await addRecord({ batch_id: batch.id, entity, status: 'received', raw_payload: payload?.data?.[entity]?.[index] || {}, normalized_payload: record, issues_count: issues.length }, { accountId });
      for (const issue of issues) {
        await addIssue({ batch_id: batch.id, record_id: persistedRecord.id, entity: issue.entity, field: issue.field, code: issue.code, message: issue.message, severity: issue.code === 'DUPLICATE' ? 'warning' : 'error' }, { accountId });
      }
      await updateBatchStatus(batch.id, 'validating', { accountId });
    }
  }
  await updateBatchStatus(batch.id, 'normalized', { accountId });
  await updateBatchSummary(batch.id, buildLegacyImportSummary(result.normalized, result.duplicates, result.issues), { accountId });
  return { batchId: batch.id, dryRun: true, summary: buildLegacyImportSummary(result.normalized, result.duplicates, result.issues), issues: result.issues, normalizedSamples: Object.fromEntries(Object.entries(result.normalized).map(([entity, items]) => [entity, items.slice(0, 2)])) };
}

export async function executeLegacyImportHandler(context = {}) {
  assertContextAccount(context);
  assertLegacyImportAllowed();
  const payload = ensureLegacyImportPayload(context.body || {});
  if (payload.dryRun === true) {
    return { dryRun: true, summary: buildLegacyExecuteSummary({}), issues: [{ entity: '_global', index: 0, field: 'dryRun', code: 'DRY_RUN', message: 'dryRun nao pode executar' }] };
  }
  const result = validateAndNormalizeLegacyPayload(payload);
  const accountId = assertContextAccount(context);
  const batch = await createBatch({ source: String(payload.source || 'legacy-import'), status: 'approved', dry_run: false, summary: buildLegacyExecuteSummary(result.normalized) }, { accountId });
  let approvedRecords = 0;
  for (const entity of Object.keys(result.normalized)) {
    for (const [index, record] of result.normalized[entity].entries()) {
      const issues = result.issues.filter((issue) => issue.entity === entity && issue.index === index);
      const persistedRecord = await addRecord({ batch_id: batch.id, entity, status: 'approved', raw_payload: payload?.data?.[entity]?.[index] || {}, normalized_payload: record, issues_count: issues.length }, { accountId });
      approvedRecords += 1;
      for (const issue of issues) {
        await addIssue({ batch_id: batch.id, record_id: persistedRecord.id, entity: issue.entity, field: issue.field, code: issue.code, message: issue.message, severity: issue.code === 'DUPLICATE' ? 'warning' : 'error' }, { accountId });
      }
    }
  }
  await updateBatchStatus(batch.id, 'approved', { accountId });
  await updateBatchSummary(batch.id, buildLegacyExecuteSummary(result.normalized), { accountId });
  return { batchId: batch.id, dryRun: false, approvedRecords, summary: buildLegacyExecuteSummary(result.normalized), issues: result.issues };
}

export async function listLegacyImportBatchesHandler(context = {}) {
  const accountId = assertContextAccount(context);
  assertLegacyImportAllowed();
  return { batches: await listBatches({ accountId }) };
}

export async function getLegacyImportBatchHandler(context = {}) {
  const accountId = assertContextAccount(context);
  assertLegacyImportAllowed();
  const batchId = context.params?.batchId;
  const [batch, summary] = await Promise.all([getBatch(batchId, { accountId }), getBatchSummary(batchId, { accountId })]);
  return {
    batch: {
      ...batch,
      approval: {
        status: batch.status || 'unknown',
        approvedBy: batch.approved_by || null,
        approvedAt: batch.approved_at || null,
        rejectedBy: batch.rejected_by || null,
        rejectedAt: batch.rejected_at || null,
        reason: batch.rejection_reason || null
      },
      summary
    }
  };
}

export async function getLegacyImportBatchRecordsHandler(context = {}) {
  const accountId = assertContextAccount(context);
  assertLegacyImportAllowed();
  return { records: await getBatchRecords(context.params?.batchId, { accountId }) };
}

export async function getLegacyImportBatchIssuesHandler(context = {}) {
  const accountId = assertContextAccount(context);
  assertLegacyImportAllowed();
  return { issues: await getBatchIssues(context.params?.batchId, { accountId }) };
}

function assertOperationalRole(context = {}) {
  const role = String(context.auth?.role || '');
  if (!['manager', 'admin', 'super_admin'].includes(role)) {
    throw new ValidationError('Role sem permissao', { domain: 'legacy-import' });
  }
}

export async function approveLegacyImportBatchHandler(context = {}) {
  assertContextAccount(context);
  assertOperationalRole(context);
  assertLegacyImportAllowed();
  const accountId = assertContextAccount(context);
  const batchId = context.params?.batchId;
  const issues = await getBatchIssues(batchId, { accountId });
  if (issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, code: 'BATCH_HAS_ERRORS' };
  }
  const batch = await approveBatch(batchId, { accountId, actor: context.auth?.userId || context.auth?.email || context.auth?.role || 'system' });
  const records = await getBatchRecords(batchId, { accountId });
  for (const record of records) {
    await updateRecordStatus(record.id, 'approved', { accountId });
  }
  return { ok: true, batch };
}

export async function rejectLegacyImportBatchHandler(context = {}) {
  assertContextAccount(context);
  assertOperationalRole(context);
  assertLegacyImportAllowed();
  const accountId = assertContextAccount(context);
  const batchId = context.params?.batchId;
  const reason = String(context.body?.reason || '').trim();
  if (!reason) throw new ValidationError('reason obrigatorio', { domain: 'legacy-import' });
  const batch = await rejectBatch(batchId, { accountId, reason, actor: context.auth?.userId || context.auth?.email || context.auth?.role || 'system' });
  const records = await getBatchRecords(batchId, { accountId });
  for (const record of records) {
    await updateRecordStatus(record.id, 'rejected', { accountId });
  }
  return { ok: true, batch };
}

export async function promoteLegacyImportBatchHandler(context = {}) {
  assertContextAccount(context);
  assertOperationalRole(context);
  assertLegacyImportAllowed();
  const accountId = assertContextAccount(context);
  const batchId = context.params?.batchId;
  return promoteLegacyImportBatch(batchId, { accountId, context });
}

export async function auditLegacyImportBatchHandler(context = {}) {
  const accountId = assertContextAccount(context);
  assertLegacyImportAllowed();
  return { report: await auditPromotion(context.params?.batchId, { accountId }) };
}

export async function getLegacyImportBatchReportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  assertLegacyImportAllowed();
  return { report: await buildPromotionReport(context.params?.batchId, { accountId }) };
}
