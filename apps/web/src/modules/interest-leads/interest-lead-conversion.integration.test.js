import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInterestLeadDetailsPage } from '../interest-leads-details/interest-lead-details.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('interest lead conversion integration', async () => {
  const dom = setupFrontendDom('#/interest-leads/1');
  let converted = false;
  const apiClient = {
    get: async (u) => u.endsWith('/events') ? ({ items: [] }) : ({ item: { id: '1', nome: 'Ana', empresa: 'Acme', status: converted ? 'convertido' : 'novo' } }),
    patch: async () => ({ ok: true }),
    post: async (u) => { if (u.endsWith('/convert')) converted = true; return { status: 'trial', subscriberRef: 'acc-1' }; }
  };
  await renderInterestLeadDetailsPage(document.body, { apiClient, leadId: '1' });
  await flush();
  document.querySelector('#cv').click();
  document.querySelector('#cv').click();
  document.querySelector('#cv').click();
  await flush(); await flush();
  assert.match(document.body.textContent, /pendente|convertido|sucesso/i);
  teardownFrontendDom(dom);
});
