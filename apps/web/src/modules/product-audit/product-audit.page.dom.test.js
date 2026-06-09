import assert from 'node:assert/strict';
import test from 'node:test';
import { renderProductAuditPage } from './product-audit.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('product audit page renders kpis, table and actions', async () => {
  const dom = setupFrontendDom('#/product-audit');
  const root = document.getElementById('root');
  const apiClient = {
    get: async (url) => {
      if (url === '/product-audit/products') return { items: [{ id: 'p1', nome: 'Produto A', sku: 'SKU1', fabricanteNome: '-', categoria: '-', preco: 10, estoque: 0, status: 'ativo', issues: ['missing_fabricante'] }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }, summary: { totalProdutos: 1, comProblemas: 1, semFabrica: 1, semImagem: 0, semCategoria: 0, duplicados: 0, inativos: 0, estoqueZerado: 1 } };
      if (url === '/fabricantes') return { items: [{ id: 'f1', nome: 'Fab 1' }] };
      if (url === '/product-audit/products/p1') return { id: 'p1', nome: 'Produto A', issues: ['missing_fabricante'] };
      return {};
    },
    patch: async () => ({})
  };
  renderProductAuditPage(root, { apiClient });
  await flush();
  assert.ok(root.textContent.includes('Auditoria de Produtos'));
  assert.ok(root.textContent.includes('Sem fábrica'));
  assert.ok(root.textContent.includes('Produtos com problema'));
  assert.ok(root.textContent.includes('Ver Produto'));
  assert.ok(root.textContent.includes('Editar Produto'));
  const row = root.querySelector('.nha-row');
  row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await flush();
  assert.equal(window.location.hash, '#/produtos/p1');
  teardownFrontendDom(dom);
});
