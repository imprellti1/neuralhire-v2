import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, resetFetchCalls } from '../../testing/mocks/api-client.mock.js';

let dom;

test('ai director route smoke', async () => {
  dom = setupFrontendDom('#/diretor-ia');
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
    }),
    'GET /ai-director/memories': () => ({ items: [] }),
    'GET /ai-director/tasks': () => ({ items: [] }),
    'GET /ai-director/managers': () => ({ managers: [] })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Diretor IA/);
  assert.ok(document.querySelector('[data-route="#/diretor-ia"]'));
});

test.after(() => {
  if (!dom) return;
  if (typeof globalThis.__clearRafTimers === 'function') globalThis.__clearRafTimers();
  const content = global.document?.getElementById?.('app-content');
  if (content && typeof content.__aiDirectorCleanup === 'function') {
    content.__aiDirectorCleanup();
    delete content.__aiDirectorCleanup;
  }
  if (global.window?.location) window.location.hash = '';
  if (global.document?.body) document.body.innerHTML = '';
  resetFetchCalls();
  teardownFrontendDom(dom);
  dom = undefined;
});
