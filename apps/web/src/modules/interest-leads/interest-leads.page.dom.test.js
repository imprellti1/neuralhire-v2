import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInterestLeadsPage } from './interest-leads.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('interest-leads page dom: listagem e empty state', async () => {
  const dom = setupFrontendDom('#/interest-leads');
  const apiClient = { get: async () => ({ ok: true, items: [{ id: '1', nome: 'Ana', empresa: 'Acme', email: 'ana@acme.com', status: 'novo' }], pagination: { page: 1, total: 1 } }), patch: async () => ({ ok: true, item: { id: '1', status: 'contatado' } }) };
  renderInterestLeadsPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Ana/);
  teardownFrontendDom(dom);
});
