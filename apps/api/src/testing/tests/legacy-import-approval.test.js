import assert from 'node:assert/strict';
import { approveLegacyImportBatchHandler, getLegacyImportBatchHandler, rejectLegacyImportBatchHandler } from '../../modules/legacy-import/legacy-import.controller.js';
import { __resetLegacyImportStagingMemoryForTests, addIssue, createBatch, addRecord } from '../../modules/legacy-import/legacy-import-staging.repository.js';

function createContext(overrides = {}) {
  return {
    auth: { authenticated: true, role: 'admin', accountId: 'acc-test-1', userId: 'user-1', ...(overrides.auth || {}) },
    body: {},
    params: {},
    ...overrides
  };
}

export function getLegacyImportApprovalTests() {
  return [
    { name: 'aprovar lote válido', run: async () => { __resetLegacyImportStagingMemoryForTests(); const batch = await createBatch({ source: 'legacy', status: 'validated' }, { accountId: 'acc-test-1' }); await addRecord({ batch_id: batch.id, entity: 'clientes', status: 'validated', raw_payload: {} }, { accountId: 'acc-test-1' }); const result = await approveLegacyImportBatchHandler(createContext({ params: { batchId: batch.id } })); assert.equal(result.ok, true); assert.equal(result.batch.status, 'approved'); } },
    { name: 'rejeitar lote', run: async () => { __resetLegacyImportStagingMemoryForTests(); const batch = await createBatch({ source: 'legacy', status: 'validated' }, { accountId: 'acc-test-1' }); await addRecord({ batch_id: batch.id, entity: 'clientes', status: 'validated', raw_payload: {} }, { accountId: 'acc-test-1' }); const result = await rejectLegacyImportBatchHandler(createContext({ body: { reason: 'dados inconsistentes' }, params: { batchId: batch.id } })); assert.equal(result.batch.status, 'rejected'); assert.equal(result.batch.rejection_reason, 'dados inconsistentes'); } },
    { name: 'bloqueio com issue error', run: async () => { __resetLegacyImportStagingMemoryForTests(); const batch = await createBatch({ source: 'legacy', status: 'validated' }, { accountId: 'acc-test-1' }); await addIssue({ batch_id: batch.id, entity: 'clientes', severity: 'error', message: 'falha' }, { accountId: 'acc-test-1' }); const result = await approveLegacyImportBatchHandler(createContext({ params: { batchId: batch.id } })); assert.equal(result.ok, false); assert.equal(result.code, 'BATCH_HAS_ERRORS'); } },
    { name: 'tenant isolation', run: async () => { __resetLegacyImportStagingMemoryForTests(); const batch = await createBatch({ source: 'legacy', status: 'validated' }, { accountId: 'acc-a' }); await assert.rejects(() => approveLegacyImportBatchHandler(createContext({ params: { batchId: batch.id }, auth: { accountId: 'acc-b' } }))); } },
    { name: 'role inválida bloqueada', run: async () => { __resetLegacyImportStagingMemoryForTests(); const batch = await createBatch({ source: 'legacy', status: 'validated' }, { accountId: 'acc-test-1' }); await assert.rejects(() => approveLegacyImportBatchHandler(createContext({ auth: { role: 'viewer' }, params: { batchId: batch.id } }))); } },
    { name: 'grava approved_at e rejected_at', run: async () => { __resetLegacyImportStagingMemoryForTests(); const batch = await createBatch({ source: 'legacy', status: 'validated' }, { accountId: 'acc-test-1' }); await addRecord({ batch_id: batch.id, entity: 'clientes', status: 'validated', raw_payload: {} }, { accountId: 'acc-test-1' }); await approveLegacyImportBatchHandler(createContext({ params: { batchId: batch.id } })); const approved = await getLegacyImportBatchHandler(createContext({ params: { batchId: batch.id } })); assert.ok(approved.batch.approval.approvedAt); const rejectedBatch = await createBatch({ source: 'legacy', status: 'validated' }, { accountId: 'acc-test-1' }); await rejectLegacyImportBatchHandler(createContext({ body: { reason: 'x' }, params: { batchId: rejectedBatch.id } })); const rejected = await getLegacyImportBatchHandler(createContext({ params: { batchId: rejectedBatch.id } })); assert.ok(rejected.batch.approval.rejectedAt); assert.equal(rejected.batch.approval.reason, 'x'); } }
  ];
}
