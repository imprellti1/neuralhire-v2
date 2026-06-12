import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('ai director route smoke', async () => {
  const dom = setupFrontendDom('#/diretor-ia');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /ai-director/dashboard': () => ({
      health: {
        receita_mes: 124550,
        pedidos_mes: 358,
        clientes_ativos: 78,
        clientes_risco: 15
      },
      alerts: [{ severity: 'high', title: 'Faturamento caiu 18% nos últimos 15 dias' }],
      opportunities: [{ title: '12 clientes demonstraram intenção de compra' }]
    })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Diretor IA/);
  assert.ok(document.querySelector('[data-route="#/diretor-ia"]'));
  teardownFrontendDom(dom);
});
