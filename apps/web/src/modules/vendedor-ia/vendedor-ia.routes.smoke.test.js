import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { renderVendedorIaPage } from './vendedor-ia.page.js';
import { setupFrontendDom, teardownFrontendDom, flush, mockAuthenticatedSession } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, resetFetchCalls } from '../../testing/mocks/api-client.mock.js';

test('vendedor ia: smoke da rota', async () => {
  const dom = setupFrontendDom('#/vendedor-ia', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  resetFetchCalls();
  installFetchMock({
    'GET /ai-sales/overview': () => ({ total_clientes: 0, clientes_em_risco: 0, clientes_inativos: 0, oportunidades: 0, faturamento_carteira: 0, ticket_medio: 0, pedidos_30_dias: 0 }),
    'GET /ai-sales/portfolio': () => ({ items: [] }),
    'GET /ai-sales/alerts': () => ({ items: [] }),
    'GET /ai-sales/opportunities': () => ({ items: [] }),
    'GET /ai-sales/tasks': () => ({ items: [] }),
    'GET /ai-sales/insights': () => ({ riskClients: [], inactiveClients: [], opportunities: [], generatedTasks: [] }),
    'GET /ai-sales/performance': () => ({ faturamento_carteira: 0, clientes_ativos: 0, clientes_recuperados: 0, oportunidades_geradas: 0 })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Vendedor IA/i);
  assert.equal(document.querySelector('a[href="#/vendedor-ia"]') !== null, true);
  teardownFrontendDom(dom);
});
