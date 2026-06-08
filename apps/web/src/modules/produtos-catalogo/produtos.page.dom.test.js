import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProdutosPage } from './produtos.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('listagem de produtos mostra fábrica e fallback', async () => {
  const dom = setupFrontendDom('#/produtos');
  const apiClient = {
    async get(path) {
      if (path === '/produtos') return { items: [{ id: 'p1', nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', fabricante_nome: 'Fábrica 1', preco: 10, status: 'ativo', created_at: '2026-01-01T00:00:00.000Z' }, { id: 'p2', nome: 'Produto 2', sku: 'SKU2', categoria: 'Cat', preco: 10, status: 'ativo', created_at: '2026-01-02T00:00:00.000Z' }], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } };
      throw new Error(`unhandled get ${path}`);
    }
  };

  const root = document.getElementById('root');
  renderProdutosPage(root, { apiClient });
  await flush(); await flush();
  const text = root.textContent;
  assert.match(text, /Fábrica 1/);
  assert.match(text, /Sem fábrica/);
  teardownFrontendDom(dom);
});
