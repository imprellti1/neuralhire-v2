import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('product editor route smoke', async () => {
  const dom = setupFrontendDom('#/product-editor');
  installFetchMock({ 'GET /product-editor/products': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Editor de Produtos/);
  teardownFrontendDom(dom);
});
