import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('launch-templates route smoke', async () => {
  const dom = setupFrontendDom('#/launch/templates', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /launch/templates': () => ({ ok: true, items: [] }),
    'GET /interest-leads': () => ({ ok: true, items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Templates de Lancamento/i);
  teardownFrontendDom(dom);
});
