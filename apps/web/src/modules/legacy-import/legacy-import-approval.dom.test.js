import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLegacyImportPage } from './legacy-import.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('legacy import approval renders actions and modal', async () => {
  const dom = setupFrontendDom('#/legacy-import');
  const calls = [];
  const apiClient = {
    get: async (path) => {
      if (path === '/legacy-import/status') return { enabled: true, stagingEnabled: true, stagingTables: ['legacy_import_batches'], environment: 'development', supportedEntities: ['clientes'], mode: 'preview', warnings: [] };
      if (path === '/legacy-import/batches') return { batches: [{ id: 'batch-1', status: 'normalized', source: 'legacy-admin', dryRun: true, createdAt: '2026-06-01T00:00:00.000Z', approval: { status: 'normalized' }, summary: { total: 1, valid: 1, invalid: 0, warnings: 0, errors: 0, status: 'normalized' } }] };
      if (path === '/legacy-import/batches/batch-1') return { batch: { id: 'batch-1', status: 'normalized', source: 'legacy-admin', dry_run: true, created_at: '2026-06-01T00:00:00.000Z', approval: { status: 'normalized' }, summary: { total: 1, valid: 1, invalid: 0, warnings: 0, errors: 0, status: 'normalized' } } };
      if (path === '/legacy-import/batches/batch-1/records') return { records: [{ entity: 'clientes', status: 'received', legacy_id: '1' }] };
      if (path === '/legacy-import/batches/batch-1/issues') return { issues: [{ entity: 'clientes', severity: 'warning', message: 'ok' }] };
      return {};
    },
    post: async (path, payload) => { calls.push({ path, payload }); return { ok: true, batch: { status: path.includes('reject') ? 'rejected' : 'approved' } }; }
  };
  await renderLegacyImportPage(document.body, { apiClient });
  await flush();
  assert.ok(document.querySelector('#legacy-approve'));
  assert.ok(document.querySelector('#legacy-reject'));
  assert.match(document.body.textContent, /Resumo Executivo/);
  document.querySelector('#legacy-reject').click();
  await flush();
  assert.ok(document.querySelector('#legacy-reject-modal'));
  document.querySelector('#legacy-reject-reason').value = 'motivo';
  document.querySelector('#legacy-reject-confirm').click();
  await flush();
  assert.ok(calls.some((call) => call.path.endsWith('/reject')));
  teardownFrontendDom(dom);
});
