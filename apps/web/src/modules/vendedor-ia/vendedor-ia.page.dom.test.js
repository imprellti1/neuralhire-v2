import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVendedorIaPage } from './vendedor-ia.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('vendedor ia page renderiza abas e dados principais', async () => {
  const dom = setupFrontendDom('#/vendedor-ia', 'app.neuralhire.com.br');
  const apiClient = {
    get: async (path) => {
      if (path === '/ai-sales/overview') return { total_clientes: 3, clientes_em_risco: 1, clientes_inativos: 1, oportunidades: 2, faturamento_carteira: 15000, ticket_medio: 5000, pedidos_30_dias: 4 };
      if (path === '/ai-sales/portfolio') return { items: [{ cliente_id: 'c1', nome: 'Cliente 1', cidade: 'São Paulo', score: 72, classificacao: 'saudável', ultimo_pedido: '2026-06-01T00:00:00.000Z', dias_sem_comprar: 18, status_risco: 'low' }] };
      if (path === '/ai-sales/alerts') return { items: [{ nome: 'Cliente 1', motivo: 'alerta comercial ativo', impacto_estimado: 1200 }] };
      if (path === '/ai-sales/opportunities') return { items: [{ cliente: 'Cliente 2', motivo: 'cliente inativo com histórico relevante', impacto_estimado: 2200 }] };
      if (path === '/ai-sales/tasks') return { items: [{ title: 'Delegação futura', description: 'Preparar contrato de delegação', priority: 'medium' }] };
      if (path === '/ai-sales/performance') return { faturamento_carteira: 15000, clientes_ativos: 2, clientes_recuperados: 1, oportunidades_geradas: 2 };
      return {};
    }
  };
  await renderVendedorIaPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Vendedor IA/i);
  assert.match(document.body.textContent, /Clientes/i);
  assert.match(document.body.textContent, /Carteira/i);
  assert.equal(document.querySelector('[data-tab="portfolio"]') !== null, true);
  document.querySelector('[data-tab="alerts"]').click();
  await flush();
  assert.match(document.body.textContent, /alerta comercial ativo/i);
  document.querySelector('[data-tab="performance"]').click();
  await flush();
  assert.match(document.body.textContent, /Clientes recuperados/i);
  teardownFrontendDom(dom);
});

