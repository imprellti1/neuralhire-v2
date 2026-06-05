import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('vendedores: smoke da rota', async () => {
  const dom = setupFrontendDom('#/vendedores');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /vendedores': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.ok(document.querySelector('#nhv-search'));
  teardownFrontendDom(dom);
});
