import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLegacyImportPage } from './legacy-import.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('legacy import page renders and loads status', async () => {
  const dom = setupFrontendDom('#/legacy-import');
  const apiClient = {
    get: async (path) => {
      if (path === '/legacy-import/status') return { enabled: true, stagingEnabled: true, stagingTables: ['legacy_import_batches'], environment: 'development', supportedEntities: ['clientes'], mode: 'preview', warnings: [] };
      if (path === '/legacy-import/batches') return { batches: [{ id: 'batch-1', status: 'normalized', source: 'legacy-admin', dryRun: true, createdAt: '2026-06-01T00:00:00.000Z' }] };
      if (path === '/legacy-import/batches/batch-1') return { batch: { id: 'batch-1', status: 'normalized', source: 'legacy-admin', dry_run: true, created_at: '2026-06-01T00:00:00.000Z' } };
      if (path === '/legacy-import/batches/batch-1/records') return { records: [{ entity: 'clientes', status: 'received', legacy_id: '1' }] };
      if (path === '/legacy-import/batches/batch-1/issues') return { issues: [{ entity: 'clientes', severity: 'warning', message: 'ok' }] };
      return {};
    },
    post: async () => ({ dryRun: true, summary: {}, issues: [], normalizedSamples: {} })
  };
  await renderLegacyImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Importacao Legado/);
  assert.match(document.body.textContent, /Lotes de Importacao/);
  assert.ok(document.querySelector('#legacy-json'));
  teardownFrontendDom(dom);
});
