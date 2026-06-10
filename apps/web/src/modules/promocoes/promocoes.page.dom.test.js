import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('promoções: rota e tela renderizam', async () => {
  const dom = setupFrontendDom('#/promocoes');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /promocoes': () => ({ items: [], total: 0 }) });
  bootstrapWebApp();
  await flush();
  assert.ok(document.body.textContent.includes('Promoções'));
  teardownFrontendDom(dom);
});
