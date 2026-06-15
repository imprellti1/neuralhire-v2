import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPedidoDetailsPage } from './pedido-details.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('pedido details page shows emission date in summary and keeps audit dates', async () => {
  const dom = setupFrontendDom('#/pedidos/1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url) => {
      calls.push({ method: 'GET', url });
      if (url === '/pedidos/1') {
        return {
          pedido: {
            id: '1',
            numero: 'PED-1',
            cliente_nome: 'Cliente Teste',
            status: 'confirmado',
            origem: 'manual',
            data_emissao: '2024-06-11',
            created_at: '2024-06-10T10:00:00Z',
            updated_at: '2024-06-12T11:30:00Z',
            observacoes: '',
            total: 150,
            cliente_id: 'cliente-1'
          },
          itens: []
        };
      }
      if (url === '/pedidos/1/history') {
        return { items: [] };
      }
      return { items: [] };
    },
    patch: async () => ({ item: { id: '1' } })
  };

  renderPedidoDetailsPage(root, { apiClient, pedidoId: '1' });
  await flush();

  assert.ok(root.textContent.includes('Resumo do Pedido'));
  assert.ok(root.textContent.includes('Data de emissão'));
  assert.ok(root.textContent.includes('11/06/2024'));
  assert.ok(!root.textContent.includes('Data de criação'));
  assert.ok(root.textContent.includes('Criado em'));
  assert.ok(root.textContent.includes('Atualizado em'));
  assert.ok(calls.some((call) => call.method === 'GET' && call.url === '/pedidos/1'));
  assert.ok(calls.some((call) => call.method === 'GET' && call.url === '/pedidos/1/history'));

  teardownFrontendDom(dom);
});
