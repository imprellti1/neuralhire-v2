import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBillingPage } from './billing.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('billing page dom', async () => {
  const dom = setupFrontendDom('#/billing');
  const apiClient = { get: async () => ({ ok: true, items: [{ code: 'starter', name: 'Starter' }] }) };
  await renderBillingPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Billing/);
  assert.match(document.body.textContent, /Starter/);
  assert.ok(!document.body.textContent.toLowerCase().includes('cartao'));
  teardownFrontendDom(dom);
});
