import assert from 'node:assert/strict';
import test from 'node:test';
import { renderClienteDetailsPage } from './cliente-details.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('cliente details comercial agrupa pedidos por status e mantém accordions fechados por padrão', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ url, params });
      if (url === '/clientes/c1') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente A',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') {
        return {
          items: [
            { id: 'p1', cliente_id: 'c1', numero: '3001', status: 'faturado', valor_total: 300, data_faturamento: '2026-06-12T00:00:00.000Z', created_at: '2026-06-10T00:00:00.000Z', itens: [{ produto: 'Produto A', quantidade: 1, preco_unitario: 300, total: 300 }] },
            { id: 'p2', cliente_id: 'c1', numero: '3002', status: 'cancelado', valor_total: 200, data_faturamento: '2026-06-10T00:00:00.000Z', created_at: '2026-06-09T00:00:00.000Z', itens: [{ produto: 'Produto B', quantidade: 2, preco_unitario: 100, total: 200 }] },
            { id: 'p3', cliente_id: 'c1', numero: '3003', status: 'pendente', valor_total: 150, created_at: '2026-06-11T00:00:00.000Z', itens: [{ produto: 'Produto C', quantidade: 3, preco_unitario: 50, total: 150 }] }
          ],
          pagination: { page: 1, totalPages: 1, total: 3, limit: 100 }
        };
      }
      if (url === '/pedidos/p1') return { item: { id: 'p1', itens: [{ produto: 'Produto A', quantidade: 1, preco_unitario: 300, total: 300 }] } };
      return { items: [] };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="comercial"]')?.click();
  await flush();
  await flush();

  const text = root.textContent.replace(/\s+/g, ' ');
  assert.match(text, /Faturados/);
  assert.match(text, /Em aberto/);
  assert.match(text, /Cancelados/);
  assert.ok(text.indexOf('Faturados') < text.indexOf('Cancelados'));
  assert.ok(!text.includes('Produto A'));

  root.querySelector('[data-toggle-group="faturados"]')?.click();
  await flush();
  await flush();
  assert.match(root.textContent, /Pedido 3001/);
  assert.ok(!root.textContent.includes('Pedido 3002'));
  assert.match(root.textContent, /R\$\s*300,00/);
  assert.match(root.textContent, /12\/06\/2026/);

  root.querySelector('[data-toggle-pedido="p1"]')?.click();
  await flush();
  await flush();
  assert.match(root.textContent, /Produto A/);
  assert.ok(calls.some((call) => call.url === '/pedidos/p1'));

  teardownFrontendDom(dom);
});
