import assert from 'node:assert/strict';
import { promoteLegacyImportBatch } from '../../modules/legacy-import/legacy-import-promoter.js';
import { addIssue, addRecord, createBatch, __resetLegacyImportStagingMemoryForTests } from '../../modules/legacy-import/legacy-import-staging.repository.js';

function ctx(accountId = 'acc-test-1') {
  return { accountId, auth: { role: 'admin', accountId } };
}

export function getLegacyImportPromotionTests() {
  return [
    {
      name: 'blocks non-approved batch',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ status: 'normalized', dry_run: false, source: 'legacy-admin' }, { accountId: 'acc-test-1' });
        const result = await promoteLegacyImportBatch(batch.id, ctx());
        assert.equal(result.ok, false);
        assert.equal(result.code, 'BATCH_NOT_APPROVED');
      }
    },
    {
      name: 'promotes approved batch',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ status: 'approved', dry_run: false, source: 'legacy-admin' }, { accountId: 'acc-test-1' });
        await addRecord({ batch_id: batch.id, entity: 'clientes', status: 'approved', normalized_payload: { nome: 'Cliente A', cnpj: '123', codigo_cliente_fabricante: 'ABC' } }, { accountId: 'acc-test-1' });
        const result = await promoteLegacyImportBatch(batch.id, ctx());
        assert.equal(result.ok, true);
        assert.equal(result.status, 'imported');
        assert.ok(result.summary.clientes.created >= 0);
      }
    },
    {
      name: 'batch already imported is idempotent',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ status: 'imported', dry_run: false, source: 'legacy-admin' }, { accountId: 'acc-test-1' });
        const result = await promoteLegacyImportBatch(batch.id, ctx());
        assert.equal(result.code, 'BATCH_ALREADY_IMPORTED');
      }
    },
    {
      name: 'blocks batch with error issues',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ status: 'approved', dry_run: false, source: 'legacy-admin' }, { accountId: 'acc-test-1' });
        const record = await addRecord({ batch_id: batch.id, entity: 'pedidos', status: 'approved', normalized_payload: { numero: '1' } }, { accountId: 'acc-test-1' });
        await addIssue({ batch_id: batch.id, record_id: record.id, entity: 'pedidos', field: 'cliente_id', code: 'BAD', message: 'bad', severity: 'error' }, { accountId: 'acc-test-1' });
        const result = await promoteLegacyImportBatch(batch.id, ctx());
        assert.equal(result.ok, false);
        assert.equal(result.code, 'BATCH_HAS_ERRORS');
      }
    }
  ];
}
