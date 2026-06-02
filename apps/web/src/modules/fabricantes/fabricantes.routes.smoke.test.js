import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('fabricantes: smoke da rota e menu', async () => {
  const dom = setupFrontendDom('#/fabricantes');
  installFetchMock({ 'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.ok(document.querySelector('[data-route="#/fabricantes"]'));
  teardownFrontendDom(dom);
});
