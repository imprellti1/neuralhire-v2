import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVendedorIaPage } from './vendedor-ia.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('vendedor ia: smoke da rota', async () => {
  const dom = setupFrontendDom('#/vendedor-ia', 'app.neuralhire.com.br');
  const apiClient = { get: async (path) => (path === '/ai-sales/overview' ? { total_clientes: 0, clientes_em_risco: 0, clientes_inativos: 0, oportunidades: 0, faturamento_carteira: 0, ticket_medio: 0, pedidos_30_dias: 0 } : { items: [] }) };
  await renderVendedorIaPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Vendedor IA/i);
  teardownFrontendDom(dom);
});

