import assert from 'node:assert/strict';
import test from 'node:test';
import { renderProductAuditPage } from './product-audit.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('product audit page renders kpis, table and actions', async () => {
  const dom = setupFrontendDom('#/product-audit');
  const root = document.getElementById('root');
  const apiClient = {
    get: async (url) => {
      if (url === '/product-audit/summary') return { totalProducts: 1, withFabricante: 0, withoutFabricante: 1, withImage: 0, withoutImage: 1, withCategory: 0, withoutCategory: 1, duplicates: 0, inactive: 0, zeroStock: 1, issues: [] };
      if (url === '/product-audit/products') return { items: [{ id: 'p1', nome: 'Produto A', sku: 'SKU1', fabricanteNome: '-', categoria: '-', preco: 10, estoque: 0, status: 'ativo', issues: ['missing_fabricante'] }] };
      if (url === '/fabricantes') return { items: [{ id: 'f1', nome: 'Fab 1' }] };
      if (url === '/product-audit/products/p1') return { id: 'p1', nome: 'Produto A', issues: ['missing_fabricante'] };
      return {};
    },
    patch: async () => ({})
  };
  renderProductAuditPage(root, { apiClient });
  await flush();
  assert.ok(root.textContent.includes('Auditoria de Produtos'));
  teardownFrontendDom(dom);
});
