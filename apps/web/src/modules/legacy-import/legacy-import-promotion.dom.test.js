import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLegacyImportPage } from './legacy-import.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('legacy import promotion button shows for approved batches', async () => {
  const dom = setupFrontendDom('#/legacy-import');
  const apiClient = {
    get: async (path) => {
      if (path === '/legacy-import/status') return { enabled: true, stagingEnabled: true, environment: 'development', supportedEntities: ['clientes'], mode: 'preview', warnings: [] };
      if (path === '/legacy-import/batches') return { batches: [{ id: 'batch-1', status: 'approved', source: 'legacy-admin', dryRun: false, createdAt: '2026-06-01T00:00:00.000Z' }] };
      if (path === '/legacy-import/batches/batch-1') return { batch: { id: 'batch-1', status: 'approved', source: 'legacy-admin', dry_run: false, created_at: '2026-06-01T00:00:00.000Z' } };
      if (path === '/legacy-import/batches/batch-1/records') return { records: [{ entity: 'clientes', status: 'approved', legacy_id: '1' }] };
      if (path === '/legacy-import/batches/batch-1/issues') return { issues: [] };
      return {};
    },
    post: async () => ({ ok: true, batchId: 'batch-1', status: 'imported', summary: {} })
  };
  globalThis.confirm = () => true;
  await renderLegacyImportPage(document.getElementById('root'), { apiClient });
  await flush();
  assert.ok(document.querySelector('#legacy-promote'));
  teardownFrontendDom(dom);
});
