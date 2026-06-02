import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLegacyImportPage } from './legacy-import.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('legacy import audit renders batches records and issues', async () => {
  const dom = setupFrontendDom('#/legacy-import');
  const apiClient = {
    get: async (path) => {
      if (path === '/legacy-import/status') return { enabled: true, stagingEnabled: true, stagingTables: ['legacy_import_batches', 'legacy_import_records', 'legacy_import_issues'], environment: 'development', supportedEntities: ['clientes'], mode: 'preview', warnings: [] };
      if (path === '/legacy-import/batches') return { batches: [{ id: 'batch-1', status: 'approved', source: 'legacy-admin', dryRun: false, createdAt: '2026-06-01T00:00:00.000Z' }] };
      if (path === '/legacy-import/batches/batch-1') return { batch: { id: 'batch-1', status: 'approved', source: 'legacy-admin', dry_run: false, created_at: '2026-06-01T00:00:00.000Z' } };
      if (path === '/legacy-import/batches/batch-1/records') return { records: [{ entity: 'clientes', status: 'approved', legacy_id: '1' }] };
      if (path === '/legacy-import/batches/batch-1/issues') return { issues: [{ entity: 'clientes', severity: 'warning', message: 'ok' }] };
      if (path === '/legacy-import/batches/batch-1/audit') return { report: { batchId: 'batch-1', summary: { created: { clientes: 1 }, updated: {}, skipped: {}, failed: {} }, integrity: { orphanOrders: 0, orphanItems: 0, missingCustomers: 0, missingProducts: 0, missingVendors: 0, missingManufacturers: 0 }, warnings: [{ message: 'warn' }], errors: [] } };
      if (path === '/legacy-import/batches/batch-1/report') return { report: { batchId: 'batch-1', summary: { created: { clientes: 1 }, updated: {}, skipped: {}, failed: {} }, integrity: { orphanOrders: 0, orphanItems: 0, missingCustomers: 0, missingProducts: 0, missingVendors: 0, missingManufacturers: 0 }, warnings: [], errors: [] } };
      return {};
    },
    post: async () => ({ batchId: 'batch-1', dryRun: true, summary: {}, issues: [], normalizedSamples: {} })
  };
  await renderLegacyImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Detalhe do Lote/);
  assert.match(document.body.textContent, /Auditoria Pós-Promoção/);
  assert.match(document.body.textContent, /Records/);
  assert.match(document.body.textContent, /Issues/);
  teardownFrontendDom(dom);
});
