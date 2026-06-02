import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('customer-memory route smoke', async () => {
  const dom = setupFrontendDom('#/customer-memory/cliente-1');
  installFetchMock({
    'GET /accounts/acc-demo/customer-memory/cliente-1': () => ({ item: { commercial: { totalComprado: 100, ticketMedio: 50, diasSemCompra: 10 }, behavior: { risco: 'baixo', potencial: 'medio' }, products: { recorrentes: [] }, manufacturers: { favoritos: [] }, opportunities: [], alerts: [], summary: 'ok' } }),
    'GET /accounts/acc-demo/customer-memory/cliente-1/summary': () => ({ item: { summary: 'ok' } })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Customer Memory/i);
  teardownFrontendDom(dom);
});
