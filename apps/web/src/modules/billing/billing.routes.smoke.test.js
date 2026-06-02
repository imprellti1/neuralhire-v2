import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('billing route smoke', async () => {
  const dom = setupFrontendDom('#/billing');
  installFetchMock({ 'GET /billing/plans': () => ({ ok: true, items: [{ code: 'starter', name: 'Starter' }] }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Billing|Starter/);
  teardownFrontendDom(dom);
});
