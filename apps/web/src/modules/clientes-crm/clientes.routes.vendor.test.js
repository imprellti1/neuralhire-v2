import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('clientes: rota exibe coluna vendedor', async () => {
  const dom = setupFrontendDom('#/clientes');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /clientes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 10 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.ok(document.querySelector('#nhc-vendedor'));
  teardownFrontendDom(dom);
});
