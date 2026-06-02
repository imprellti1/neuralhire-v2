import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPromotion, buildPromotionReport, validatePromotion } from './legacy-import-auditor.js';
import { addRecord, createBatch, __resetLegacyImportStagingMemoryForTests } from './legacy-import-staging.repository.js';

test('legacy import audit without errors', async () => {
  __resetLegacyImportStagingMemoryForTests();
  const batch = await createBatch({ source: 'test', status: 'approved', dry_run: false }, { accountId: 'acc-1' });
  await addRecord({ batch_id: batch.id, entity: 'clientes', status: 'approved', normalized_payload: { account_id: 'acc-1', nome: 'Cliente A' } }, { accountId: 'acc-1' });
  const report = await validatePromotion(batch.id, { accountId: 'acc-1' });
  assert.equal(report.errors.length, 0);
});

test('legacy import audit detects orphan order and item', async () => {
  __resetLegacyImportStagingMemoryForTests();
  const batch = await createBatch({ source: 'test', status: 'approved', dry_run: false }, { accountId: 'acc-1' });
  await addRecord({ batch_id: batch.id, entity: 'pedidos', status: 'approved', normalized_payload: { numero: '1' } }, { accountId: 'acc-1' });
  await addRecord({ batch_id: batch.id, entity: 'pedidoItens', status: 'approved', normalized_payload: { sku: 'x' } }, { accountId: 'acc-1' });
  const report = await buildPromotionReport(batch.id, { accountId: 'acc-1' });
  assert.ok(report.integrity.orphanOrders >= 1);
  assert.ok(report.integrity.orphanItems >= 1);
});

test('legacy import audit persists summary', async () => {
  __resetLegacyImportStagingMemoryForTests();
  const batch = await createBatch({ source: 'test', status: 'approved', dry_run: false }, { accountId: 'acc-1' });
  await addRecord({ batch_id: batch.id, entity: 'clientes', status: 'approved', normalized_payload: { account_id: 'acc-1', nome: 'Cliente A' } }, { accountId: 'acc-1' });
  const report = await auditPromotion(batch.id, { accountId: 'acc-1' });
  assert.equal(report.batchId, batch.id);
});
