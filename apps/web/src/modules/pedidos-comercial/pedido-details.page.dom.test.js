import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPedidoDetailsData } from './pedido-details.mapper.js';
import { renderPedidoDetailsPage } from './pedido-details.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

function compactText(node) {
  return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
}

test('pedido details mapper uses real item unit prices without dividing by 100', () => {
  const mapped = mapPedidoDetailsData({
    pedido: {
      id: '1',
      numero: 'PED-1',
      cliente_nome: 'Cliente Teste',
      status: 'confirmado',
      origem: 'manual',
      total: 15000,
      cliente_id: 'cliente-1'
    },
    itens: [
      { produto_nome: 'FRONHA 50cm x 70cm TRECCENTI', quantidade: 4, preco_unitario: 17.14 },
      { produto_nome: 'FRONHA 50cm x 70cm NOBLESS', quantidade: 4, preco_unitario: 17.22 },
      { produto_nome: 'TRAVESSEIRO PREMIUM POPCORN', quantidade: 6, preco_unitario: 1.02 }
    ]
  }, { items: [] });

  assert.equal(mapped.itens[0].valorUnitario, 17.14);
  assert.equal(mapped.itens[0].totalItem, 68.56);
  assert.equal(mapped.itens[1].valorUnitario, 17.22);
  assert.equal(mapped.itens[1].totalItem, 68.88);
  assert.equal(mapped.itens[2].valorUnitario, 1.02);
  assert.equal(mapped.itens[2].totalItem, 6.12);
});

test('pedido details page renders item prices from reais without dividing by 100', async () => {
  const dom = setupFrontendDom('#/pedidos/1');
  const root = document.getElementById('root');
  const apiClient = {
    get: async (url) => {
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
            total: 15000,
            cliente_id: 'cliente-1'
          },
          itens: [
            { produto_nome: 'FRONHA 50cm x 70cm NOBLESS', quantidade: 4, preco_unitario: 17.14, status_vinculo: 'vinculado' },
            { produto_nome: 'FRONHA 50cm x 70cm TRECCENTI', quantidade: 4, preco_unitario: 17.22, status_vinculo: 'nao_encontrado' },
            { produto_nome: 'TRAVESSEIRO PREMIUM POPCORN', quantidade: 6, preco_unitario: 1.02, status_vinculo: 'vinculado' }
          ]
        };
      }
      if (url === '/pedidos/1/history') return { items: [] };
      return { items: [] };
    },
    patch: async () => ({ item: { id: '1' } })
  };

  renderPedidoDetailsPage(root, { apiClient, pedidoId: '1' });
  await flush();

  const toggle = root.querySelector('#nho2d-toggle-itens');
  assert.ok(toggle);
  toggle.click();
  await flush();

  const compact = compactText(root);
  assert.ok(compact.includes('R$ 17,14'));
  assert.ok(compact.includes('R$ 17,14'));
  assert.ok(compact.includes('R$ 17,22'));
  assert.ok(compact.includes('R$ 68,56'));
  assert.ok(compact.includes('R$ 6,12'));

  teardownFrontendDom(dom);
});

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
            total: 15000,
            cliente_id: 'cliente-1'
          },
          itens: [
            { produto_nome: 'FRONHA 50cm x 70cm TRECCENTI', quantidade: 4, preco_unitario: 17.14, status_vinculo: 'vinculado' },
            { produto_nome: 'FRONHA 50cm x 70cm NOBLESS', quantidade: 4, preco_unitario: 17.22, status_vinculo: 'nao_encontrado' },
            { produto_nome: 'TRAVESSEIRO PREMIUM POPCORN', quantidade: 6, preco_unitario: 1.02, status_vinculo: 'vinculado' }
          ]
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
  assert.ok(root.textContent.includes('Itens do pedido'));
  assert.ok(root.textContent.includes('3 itens'));
  assert.ok(!root.textContent.includes('Itens importados'));
  assert.ok(!root.textContent.includes('Total de itens'));
  assert.equal(root.querySelector('.nho2d-table-wrap'), null);
  assert.ok(calls.some((call) => call.method === 'GET' && call.url === '/pedidos/1'));
  assert.ok(calls.some((call) => call.method === 'GET' && call.url === '/pedidos/1/history'));

  const toggle = root.querySelector('#nho2d-toggle-itens');
  assert.ok(toggle);
  toggle.click();
  await flush();

  const compact = compactText(root);
  assert.ok(compact.includes('Total de itens'));
  assert.ok(compact.includes('Vinculados'));
  assert.ok(compact.includes('Não vinculados'));
  assert.ok(compact.includes('Valor total'));
  assert.ok(compact.includes('R$ 17,14'));
  assert.ok(compact.includes('R$ 17,22'));
  assert.ok(compact.includes('R$ 1,02'));
  assert.ok(compact.includes('R$ 68,56'));
  assert.ok(compact.includes('R$ 6,12'));
  assert.ok(root.querySelector('.nho2d-table-wrap'));
  assert.ok(root.querySelectorAll('.nho2d-table tbody tr').length >= 3);

  teardownFrontendDom(dom);
});

test('pedido details page shows auditoria back button when origin is auditoria', async () => {
  const dom = setupFrontendDom('#/pedidos/1?origin=auditoria');
  const root = document.getElementById('root');
  const apiClient = {
    get: async (url) => {
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

  renderPedidoDetailsPage(root, { apiClient, pedidoId: '1', routeQuery: new URLSearchParams('origin=auditoria') });
  await flush();

  const backButton = root.querySelector('#nho2d-back');
  assert.ok(backButton);
  assert.equal(backButton.textContent.trim(), '← Voltar para Auditoria');
  backButton.click();
  assert.equal(window.location.hash, '#/auditoria-pedidos');

  teardownFrontendDom(dom);
});
