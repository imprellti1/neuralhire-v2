import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPedidosAuditoriaPage } from './pedidos-auditoria.page.js';
import { dispatchChange, dispatchInput, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('pedidos auditoria page renders list and opens modals', async () => {
  const dom = setupFrontendDom('#/auditoria-pedidos');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, query) => {
      calls.push({ method: 'GET', url, query: { ...query } });
      if (url === '/pedidos/auditoria') {
        return {
          items: [
            { id: '1', numero: 'ERP-1', cliente_id: '98dc5941-b756-48bc-a29f-1dedafb81003', cliente_nome: 'Cliente 1', razao_social: 'Cliente 1', status: 'confirmado', data_emissao: '2024-06-11', data_faturamento: '2024-06-12', total: 100, comissao_principal_percentual: 10, comissao_preposto_percentual: 5, itens_count: 0, issues: ['sem_itens'], vendedor_nome: 'Ana Vendas', vendedor_id: 'vend-1' },
            { id: '2', numero: 'ERP-2', cliente_id: 'a1dc5941-b756-48bc-a29f-1dedafb81003', cliente_nome: 'Cliente 2', razao_social: 'Cliente 2', status: 'confirmado', data_emissao: '2024-06-11', data_faturamento: '2024-06-12', total: 200, comissao_principal_percentual: null, comissao_preposto_percentual: null, itens_count: 3, issues: ['sem_comissao'], vendedor_nome: 'Ana Vendas', vendedor_id: 'vend-1' },
            { id: '3', numero: 'ERP-3', cliente_id: 'b1dc5941-b756-48bc-a29f-1dedafb81003', cliente_nome: 'Cliente 3', razao_social: 'Cliente 3', status: 'confirmado', data_emissao: '2024-06-11', data_faturamento: '2024-06-12', total: 300, comissao_principal_percentual: 10, comissao_preposto_percentual: 5, itens_count: 4, issues: ['sem_vendedor'], vendedor_nome: 'Sem vendedor', vendedor_id: null },
            { id: '4', numero: 'ERP-4', cliente_id: 'c1dc5941-b756-48bc-a29f-1dedafb81003', cliente_nome: 'Cliente 4', razao_social: 'Cliente 4', status: 'confirmado', data_emissao: '2024-06-11', data_faturamento: null, total: 400, comissao_principal_percentual: 10, comissao_preposto_percentual: 5, itens_count: 2, issues: ['nao_faturado_total'], vendedor_nome: 'Ana Vendas', vendedor_id: 'vend-1' }
          ],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
        };
      }
      if (url === '/vendedores') {
        return { items: [{ id: 'vend-1', nome: 'Ana Vendas' }], pagination: { page: 1, limit: 500, total: 1, totalPages: 1 } };
      }
      return { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };
    },
    patch: async (url, body) => {
      calls.push({ method: 'PATCH', url, body });
      return { item: { id: '1' } };
    }
  };

  renderPedidosAuditoriaPage(root, { apiClient });
  await flush();

  assert.ok(root.textContent.includes('Auditoria de Pedidos'));
  assert.ok(root.textContent.includes('Sem itens'));
  assert.ok(root.textContent.includes('Sem vendedor'));
  assert.ok(root.textContent.includes('Comissão'));
  assert.ok(root.textContent.includes('Faturamento'));
  assert.ok(root.textContent.includes('Vendedor'));
  assert.ok(root.textContent.includes('Cliente 1'));
  assert.ok(root.textContent.includes('Cliente 2'));
  assert.ok(root.textContent.includes('Cliente 3'));
  assert.ok(root.textContent.includes('Cliente 4'));
  assert.ok(root.textContent.includes('11/06/2024'));
  assert.equal(calls[0].url, '/pedidos/auditoria');
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  assert.equal(rows.length, 4);
  const [rowSemItens, rowSemComissao, rowSemVendedor, rowSemFaturamento] = rows;
  const firstCells = rows.map((row) => row.querySelector('td'));
  firstCells.forEach((cell) => {
    assert.ok(cell);
    assert.ok(cell.querySelector('a[data-action="open"]'));
    assert.ok(cell.textContent.includes('Abrir'));
  });
  assert.ok(!rowSemItens.querySelector('button[data-action="vendedor"]'));
  assert.ok(!rowSemItens.querySelector('button[data-action="comissao"]'));
  assert.ok(!rowSemItens.querySelector('button[data-action="faturamento"]'));
  assert.ok(rowSemComissao.querySelector('button[data-action="comissao"]'));
  assert.ok(!rowSemComissao.querySelector('button[data-action="vendedor"]'));
  assert.ok(!rowSemComissao.querySelector('button[data-action="faturamento"]'));
  assert.ok(rowSemVendedor.querySelector('button[data-action="vendedor"]'));
  assert.ok(!rowSemVendedor.querySelector('button[data-action="comissao"]'));
  assert.ok(!rowSemVendedor.querySelector('button[data-action="faturamento"]'));
  assert.ok(rowSemFaturamento.querySelector('button[data-action="faturamento"]'));
  assert.ok(!rowSemFaturamento.querySelector('button[data-action="vendedor"]'));
  assert.ok(!rowSemFaturamento.querySelector('button[data-action="comissao"]'));
  const styleText = document.getElementById('nh-pedidos-auditoria-style').textContent;
  assert.ok(styleText.includes('.nha2-table-wrap{'));
  assert.ok(styleText.includes('overflow-x:auto'));
  assert.ok(styleText.includes('overflow-y:visible'));
  assert.ok(styleText.includes('scrollbar-gutter:stable both-edges'));
  assert.ok(styleText.includes('.nha2-table{'));
  assert.ok(styleText.includes('width:max-content'));
  assert.ok(styleText.includes('min-width:1300px'));
  assert.ok(styleText.includes('.nha2-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22);max-width:100%;overflow:visible}'));

  rowSemItens.querySelector('a[data-action="open"]').click();
  await flush();
  assert.equal(window.location.hash, '#/pedidos/1');
  window.location.hash = '#/auditoria-pedidos';
  await flush();

  rowSemComissao.querySelector('button[data-action="comissao"]').click();
  await flush();
  assert.ok(root.textContent.includes('Comissão principal %'));
  assert.ok(root.querySelector('#nha2-comissao-principal'));
  dispatchInput(root.querySelector('#nha2-comissao-principal'), '10');
  dispatchInput(root.querySelector('#nha2-comissao-preposto'), '2');
  root.querySelector('#nha2-save').click();
  await flush();
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.url === '/pedidos/2/comissao'));

  rowSemFaturamento.querySelector('button[data-action="faturamento"]').click();
  await flush();
  assert.ok(root.querySelector('#nha2-data-faturamento'));
  dispatchInput(root.querySelector('#nha2-data-faturamento'), '2026-06-15');
  root.querySelector('#nha2-save').click();
  await flush();
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.url === '/pedidos/4/faturamento'));

  rowSemVendedor.querySelector('button[data-action="vendedor"]').click();
  await flush();
  assert.ok(root.querySelector('#nha2-vendedor-id'));
  dispatchChange(root.querySelector('#nha2-vendedor-id'), 'vend-1');
  root.querySelector('#nha2-save').click();
  await flush();
  assert.ok(calls.some((call) => call.method === 'GET' && call.url === '/vendedores'));
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.url === '/pedidos/3/vendedor'));

  teardownFrontendDom(dom);
});
