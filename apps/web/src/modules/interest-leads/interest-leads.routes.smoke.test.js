import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('interest-leads route smoke', async () => {
  const dom = setupFrontendDom('#/interest-leads');
  installFetchMock({ 'GET /interest-leads': () => ({ ok: true, items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Lista de Interesse Real/i);
  teardownFrontendDom(dom);
});
