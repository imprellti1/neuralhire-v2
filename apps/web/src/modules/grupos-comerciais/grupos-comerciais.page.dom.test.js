import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('grupos comerciais page smoke', async () => {
  const dom = setupFrontendDom('#/grupos-comerciais');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /grupos-comerciais': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /clientes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 10 } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.ok(document.querySelector('[data-route="#/grupos-comerciais"]'));
  teardownFrontendDom(dom);
});
