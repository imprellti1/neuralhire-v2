import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPedidosAuditoriaPage } from './pedidos-auditoria.page.js';
import { dispatchInput, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('pedidos auditoria page renders list and opens modals', async () => {
  const dom = setupFrontendDom('#/auditoria-pedidos');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, query) => {
      calls.push({ method: 'GET', url, query: { ...query } });
      return {
        items: [
          { id: '1', numero: 'ERP-1', cliente_nome: 'Cliente A', status: 'confirmado', data_emissao: '2026-06-01', data_faturamento: null, total: 100, comissao_principal_percentual: null, comissao_preposto_percentual: null, itens_count: 0, issues: ['sem_comissao', 'sem_itens', 'nao_faturado_total'] }
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
      };
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
  assert.ok(root.textContent.includes('Definir comissão'));
  assert.ok(root.textContent.includes('Marcar faturado'));
  assert.ok(root.querySelector('a[data-action="open-detail"]'));
  assert.equal(calls[0].url, '/pedidos/auditoria');

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

  teardownFrontendDom(dom);
});
