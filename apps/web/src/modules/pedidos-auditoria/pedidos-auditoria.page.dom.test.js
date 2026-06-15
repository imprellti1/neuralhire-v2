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
            { id: '1', numero: 'ERP-1', cliente_id: '98dc5941-b756-48bc-a29f-1dedafb81003', cliente_nome: 'ZAPEM COMERCIO ATACADISTA E VAREJISTA LTDA', razao_social: 'ZAPEM COMERCIO ATACADISTA E VAREJISTA LTDA', status: 'confirmado', data_emissao: '2024-06-11', data_faturamento: null, total: 100, comissao_principal_percentual: null, comissao_preposto_percentual: null, itens_count: 0, issues: ['sem_comissao', 'sem_itens', 'sem_vendedor', 'nao_faturado_total'], vendedor_nome: 'Sem vendedor' }
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
  assert.ok(root.textContent.includes('AUDITORIA_BUILD_MARKER_ACOES_V2'));
  assert.ok(root.textContent.includes('Sem itens'));
  assert.ok(root.textContent.includes('Sem vendedor'));
  assert.ok(root.textContent.includes('AÇÕES'));
  assert.ok(root.textContent.includes('Comissão'));
  assert.ok(root.textContent.includes('Faturamento'));
  assert.ok(root.textContent.includes('Vendedor'));
  assert.ok(root.querySelector('[data-testid="auditoria-build-marker"]'));
  assert.ok(root.querySelector('button[data-action="vendedor"]'));
  assert.ok(root.querySelector('button[data-action="comissao"]'));
  assert.ok(root.querySelector('button[data-action="faturamento"]'));
  assert.ok(root.textContent.includes('ZAPEM COMERCIO ATACADISTA E VAREJISTA LTDA'));
  assert.ok(root.textContent.includes('11/06/2024'));
  assert.ok(root.querySelector('a[data-action="open-detail"]'));
  assert.equal(calls[0].url, '/pedidos/auditoria');
  const styleText = document.getElementById('nh-pedidos-auditoria-style').textContent;
  assert.ok(styleText.includes('.nha2-table-wrap{display:block;max-width:100%;width:100%;overflow-x:auto;overflow-y:hidden;border-radius:14px;overscroll-behavior-x:contain}'));
  assert.ok(styleText.includes('.nha2-col-actions{width:180px}'));
  assert.ok(styleText.includes('.nha2-actions{display:flex;gap:6px;flex-direction:column;align-items:stretch}'));
  assert.ok(styleText.includes('.nha2-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22);max-width:100%;overflow:visible}'));

  root.querySelector('a[data-action="open-detail"]').click();
  await flush();
  assert.equal(window.location.hash, '#/pedidos/1');
  window.location.hash = '#/auditoria-pedidos';
  await flush();

  root.querySelector('button[data-action="comissao"]').click();
  await flush();
  assert.ok(root.textContent.includes('Comissão principal %'));
  assert.ok(root.querySelector('#nha2-comissao-principal'));
  dispatchInput(root.querySelector('#nha2-comissao-principal'), '10');
  dispatchInput(root.querySelector('#nha2-comissao-preposto'), '2');
  root.querySelector('#nha2-save').click();
  await flush();
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.url === '/pedidos/1/comissao'));

  root.querySelector('button[data-action="faturamento"]').click();
  await flush();
  assert.ok(root.querySelector('#nha2-data-faturamento'));
  dispatchInput(root.querySelector('#nha2-data-faturamento'), '2026-06-15');
  root.querySelector('#nha2-save').click();
  await flush();
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.url === '/pedidos/1/faturamento'));

  root.querySelector('button[data-action="vendedor"]').click();
  await flush();
  assert.ok(root.querySelector('#nha2-vendedor-id'));
  dispatchChange(root.querySelector('#nha2-vendedor-id'), 'vend-1');
  root.querySelector('#nha2-save').click();
  await flush();
  assert.ok(calls.some((call) => call.method === 'GET' && call.url === '/vendedores'));
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.url === '/pedidos/1/vendedor'));

  teardownFrontendDom(dom);
});
