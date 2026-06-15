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
  assert.ok(root.textContent.includes('12/06/2024'));
  assert.equal(calls[0].url, '/pedidos/auditoria');
  const headers = Array.from(root.querySelectorAll('thead th')).map((th) => th.textContent.trim());
  assert.ok(headers.includes('Número ERP'));
  assert.ok(headers.includes('Cliente'));
  assert.ok(headers.includes('Vendedor'));
  assert.ok(headers.includes('Status'));
  assert.ok(headers.includes('Faturamento'));
  assert.ok(headers.includes('Total'));
  assert.ok(headers.includes('Comissão Principal %'));
  assert.ok(headers.includes('Comissão Preposto %'));
  assert.ok(headers.includes('Problemas'));
  assert.ok(!headers.includes('Itens'));
  assert.ok(!headers.includes('Emissão'));
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  assert.equal(rows.length, 4);
  const [rowSemItens, rowSemComissao, rowSemVendedor, rowSemFaturamento] = rows;
  const firstCells = rows.map((row) => row.querySelector('td'));
  firstCells.forEach((cell, index) => {
    assert.ok(cell);
    assert.ok(cell.querySelector('.nha2-erp-cell'));
    assert.ok(cell.querySelector('.nha2-erp-cell a[data-action="open"]'));
    assert.ok(cell.querySelector('.nha2-erp-cell button[data-action="open"]'));
    assert.ok(cell.textContent.includes('Abrir'));
    assert.ok(cell.textContent.includes(`ERP-${index + 1}`));
    assert.ok(!cell.querySelector('button[data-action="vendedor"]'));
    assert.ok(!cell.querySelector('button[data-action="comissao"]'));
    assert.ok(!cell.querySelector('button[data-action="faturamento"]'));
  });
  const problemsCells = rows.map((row) => row.querySelector('.nha2-problems-cell'));
  problemsCells.forEach((cell) => {
    assert.ok(cell);
    assert.ok(cell.querySelector('.nha2-badge'));
  });
  assert.ok(!rowSemItens.querySelector('.nha2-problems-cell button[data-action="vendedor"]'));
  assert.ok(!rowSemItens.querySelector('.nha2-problems-cell button[data-action="comissao"]'));
  assert.ok(!rowSemItens.querySelector('.nha2-problems-cell button[data-action="faturamento"]'));
  assert.ok(rowSemItens.querySelector('.nha2-problems-cell .nha2-badge'));
  assert.ok(rowSemComissao.querySelector('.nha2-problems-cell button[data-action="comissao"]'));
  assert.ok(!rowSemComissao.querySelector('.nha2-problems-cell button[data-action="vendedor"]'));
  assert.ok(!rowSemComissao.querySelector('.nha2-problems-cell button[data-action="faturamento"]'));
  assert.ok(rowSemVendedor.querySelector('.nha2-problems-cell button[data-action="vendedor"]'));
  assert.ok(!rowSemVendedor.querySelector('.nha2-problems-cell button[data-action="comissao"]'));
  assert.ok(!rowSemVendedor.querySelector('.nha2-problems-cell button[data-action="faturamento"]'));
  assert.ok(rowSemFaturamento.querySelector('.nha2-problems-cell button[data-action="faturamento"]'));
  assert.ok(!rowSemFaturamento.querySelector('.nha2-problems-cell button[data-action="vendedor"]'));
  assert.ok(!rowSemFaturamento.querySelector('.nha2-problems-cell button[data-action="comissao"]'));
  const styleText = document.getElementById('nh-pedidos-auditoria-style').textContent;
  assert.ok(styleText.includes('.nha2-table-wrap{'));
  assert.ok(styleText.includes('overflow:visible'));
  assert.ok(styleText.includes('.nha2-table{'));
  assert.ok(styleText.includes('width:100%'));
  assert.ok(styleText.includes('table-layout:fixed'));
  assert.ok(styleText.includes('.nha2-table th,.nha2-table td{padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;vertical-align:middle;white-space:normal;overflow-wrap:anywhere}'));
  assert.ok(styleText.includes('.nha2-erp-cell{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;min-width:0}'));
  assert.ok(styleText.includes('.nha2-open-btn{min-width:56px;height:24px;padding:3px 8px;font-size:11px;border-radius:8px;line-height:1}'));
  assert.ok(styleText.includes('.nha2-problems-cell{display:flex;align-items:center;justify-content:flex-start;gap:6px;flex-wrap:wrap;min-width:0}'));
  assert.ok(styleText.includes('.nha2-row-actions{display:inline-flex;flex-direction:row;gap:6px;margin-left:6px}'));
  assert.ok(styleText.includes('.nha2-row-actions .btn,.nha2-row-actions button,.nha2-row-actions .nha2-btn{width:auto;min-width:72px;min-height:24px;padding:4px 8px;font-size:11px;border-radius:8px;line-height:1.1;text-align:center;white-space:nowrap}'));
  assert.ok(styleText.includes('.nha2-col-num{width:120px}'));
  assert.ok(styleText.includes('.nha2-col-problems{width:auto;min-width:180px}'));
  assert.ok(styleText.includes('.nha2-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22);max-width:100%;overflow:visible}'));

  rowSemItens.querySelector('a[data-action="open"]').click();
  await flush();
  assert.equal(window.location.hash, '#/pedidos/1?origin=auditoria');
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
