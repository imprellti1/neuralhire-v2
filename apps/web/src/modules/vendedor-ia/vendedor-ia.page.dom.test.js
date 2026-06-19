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
      if (path === '/ai-sales/tasks') return { items: [{ id: 't1', title: 'Delegação futura', description: 'Preparar contrato de delegação', priority: 'medium', status: 'open', due_at: '2026-06-30T00:00:00.000Z', cliente_id: 'c1', cliente_nome: 'Cliente 1', vendedor_id: 'v1', delegation_level: 'vendedor' }] };
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
  document.querySelector('[data-tab="tasks"]').click();
  await flush();
  assert.match(document.body.textContent, /Cliente 1/i);
  assert.match(document.body.textContent, /Concluir/i);
  teardownFrontendDom(dom);
});

test('vendedor ia tasks nao renderiza R$ NaN sem valor e mostra valor quando existe', async () => {
  const dom = setupFrontendDom('#/vendedor-ia', 'app.neuralhire.com.br');
  const apiClient = {
    get: async (path) => {
      if (path === '/ai-sales/overview') return { total_clientes: 0, clientes_em_risco: 0, clientes_inativos: 0, oportunidades: 0, faturamento_carteira: 0, ticket_medio: 0, pedidos_30_dias: 0 };
      if (path === '/ai-sales/portfolio') return { items: [] };
      if (path === '/ai-sales/alerts') return { items: [] };
      if (path === '/ai-sales/opportunities') return { items: [] };
      if (path === '/ai-sales/performance') return { faturamento_carteira: 0, clientes_ativos: 0, clientes_recuperados: 0, oportunidades_geradas: 0 };
      if (path === '/ai-sales/tasks') {
        return { items: [
          { id: 'no-value', title: 'Sem valor', description: 'Tarefa legada', priority: 'low', status: 'open', due_at: '2026-06-30T00:00:00.000Z', cliente_id: 'c1', cliente_nome: 'Cliente 1', vendedor_id: 'v1', delegation_level: 'gerente' },
          { id: 'with-value', title: 'Com valor', description: 'Tarefa com valor', priority: 'high', status: 'open', due_at: '2026-06-30T00:00:00.000Z', cliente_id: 'c2', cliente_nome: 'Cliente 2', vendedor_id: 'v1', delegation_level: 'vendedor', financial_amount: 1250, valor: 9999 }
        ] };
      }
      return {};
    }
  };
  await renderVendedorIaPage(document.body, { apiClient });
  await flush();
  document.querySelector('[data-tab="tasks"]').click();
  await flush();
  assert.equal(document.body.textContent.includes('R$ NaN'), false);
  assert.match(document.body.textContent, /1\.250,00/i);
  teardownFrontendDom(dom);
});

test('vendedor ia tasks usa fallback seguro para campo monetary legacy', async () => {
  const dom = setupFrontendDom('#/vendedor-ia', 'app.neuralhire.com.br');
  const apiClient = {
    get: async (path) => {
      if (path === '/ai-sales/overview') return { total_clientes: 0, clientes_em_risco: 0, clientes_inativos: 0, oportunidades: 0, faturamento_carteira: 0, ticket_medio: 0, pedidos_30_dias: 0 };
      if (path === '/ai-sales/portfolio') return { items: [] };
      if (path === '/ai-sales/alerts') return { items: [] };
      if (path === '/ai-sales/opportunities') return { items: [] };
      if (path === '/ai-sales/performance') return { faturamento_carteira: 0, clientes_ativos: 0, clientes_recuperados: 0, oportunidades_geradas: 0 };
      if (path === '/ai-sales/tasks') return { items: [{ id: 'legacy', title: 'Tarefa legada', description: 'Fallback monetario', priority: 'medium', status: 'open', due_at: '2026-06-30T00:00:00.000Z', cliente_id: 'c3', cliente_nome: 'Cliente 3', vendedor_id: 'v1', delegation_level: 'gerente', monetary_value: null }] };
      return {};
    }
  };
  await renderVendedorIaPage(document.body, { apiClient });
  await flush();
  document.querySelector('[data-tab="tasks"]').click();
  await flush();
  assert.equal(document.body.textContent.includes('R$ NaN'), false);
  assert.equal(document.body.textContent.includes('R$ 0,00'), false);
  teardownFrontendDom(dom);
});

test('vendedor ia tasks prefere financial_amount sobre campos legados', async () => {
  const dom = setupFrontendDom('#/vendedor-ia', 'app.neuralhire.com.br');
  const apiClient = {
    get: async (path) => {
      if (path === '/ai-sales/overview') return { total_clientes: 0, clientes_em_risco: 0, clientes_inativos: 0, oportunidades: 0, faturamento_carteira: 0, ticket_medio: 0, pedidos_30_dias: 0 };
      if (path === '/ai-sales/portfolio') return { items: [] };
      if (path === '/ai-sales/alerts') return { items: [] };
      if (path === '/ai-sales/opportunities') return { items: [] };
      if (path === '/ai-sales/performance') return { faturamento_carteira: 0, clientes_ativos: 0, clientes_recuperados: 0, oportunidades_geradas: 0 };
      if (path === '/ai-sales/tasks') return { items: [{ id: 'prefer', title: 'Preferencia', description: 'Usa financial_amount', priority: 'medium', status: 'open', due_at: '2026-06-30T00:00:00.000Z', cliente_id: 'c4', cliente_nome: 'Cliente 4', vendedor_id: 'v1', delegation_level: 'gerente', financial_amount: 4321, valor: 1111, amount: 2222 }] };
      return {};
    }
  };
  await renderVendedorIaPage(document.body, { apiClient });
  await flush();
  document.querySelector('[data-tab="tasks"]').click();
  await flush();
  assert.match(document.body.textContent, /4\.321,00/i);
  assert.equal(document.body.textContent.includes('1\.111,00'), false);
  teardownFrontendDom(dom);
});

