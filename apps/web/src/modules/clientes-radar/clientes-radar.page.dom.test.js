import test from 'node:test';
import assert from 'node:assert/strict';
import { renderClientesRadarPage } from './clientes-radar.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('clientes radar page renderiza kpis, cards e navegação', async () => {
  const dom = setupFrontendDom('#/clientes/radar');
  const apiClient = {
    get: async (path) => {
      if (path === '/clientes/radar') {
        return {
          resumo: { total_clientes: 2, total_vip: 1, total_risco: 1, total_potenciais: 0, total_recuperacao: 0, total_inativos: 0, faturamento_total: 1000, ticket_medio_geral: 500, clientes_com_alertas: 1 },
          grupos: {
            vip: [{ id: '1', nome: 'Hermes Sangalli', score_classificacao: 'A', faturamento_total: 66205.66, total_pedidos: 13, alertas_ativos: 1, ultima_compra: new Date().toISOString() }],
            recorrentes: [],
            potenciais: [],
            recuperacao: [],
            risco: [{ id: '2', nome: 'Cliente Risco', dias_sem_compra: 120, faturamento_total: 0, total_pedidos: 0, alertas_ativos: 2 }],
            inativos: []
          }
        };
      }
      if (path === '/vendedores') return { items: [{ id: 'ven-1', nome: 'Vendedor 1' }] };
      return {};
    }
  };
  await renderClientesRadarPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Radar Comercial/i);
  assert.match(document.body.textContent, /Clientes/i);
  assert.match(document.body.textContent, /VIP/i);
  assert.match(document.body.textContent, /Hermes Sangalli/i);
  assert.equal(document.querySelector('a[href="#/clientes/1"]') !== null, true);
  teardownFrontendDom(dom);
});
