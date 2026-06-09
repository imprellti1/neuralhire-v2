import assert from 'node:assert/strict';
import test from 'node:test';
import { renderProductAuditPage } from './product-audit.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('product audit page renders kpis, table and actions', async () => {
  const dom = setupFrontendDom('#/product-audit');
  const root = document.getElementById('root');
  const apiClient = {
    get: async (url, query) => {
      if (url === '/product-audit/products') {
        if (query?.page === 2) {
          return {
            items: Array.from({ length: 5 }, (_, idx) => ({
              id: `p${idx + 21}`,
              nome: `Produto ${idx + 21}`,
              sku: `SKU${idx + 21}`,
              fabricanteNome: '-',
              categoria: '-',
              preco: 10,
              estoque: 0,
              status: 'ativo',
              issues: ['missing_fabricante']
            })),
            pagination: { page: 2, limit: 20, total: 25, totalPages: 2 },
            summary: { totalProdutos: 25, comProblemas: 25, semFabrica: 25, semImagem: 0, semCategoria: 0, duplicados: 0, inativos: 0, estoqueZerado: 25, criticos: 25, medios: 0, leves: 0 }
          };
        }
        return {
          items: Array.from({ length: 20 }, (_, idx) => ({
            id: `p${idx + 1}`,
            nome: `Produto ${idx + 1}`,
            sku: `SKU${idx + 1}`,
            fabricanteNome: '-',
            categoria: '-',
            preco: 10,
            estoque: 0,
            status: 'ativo',
            issues: ['missing_fabricante']
          })),
          pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
          summary: { totalProdutos: 25, comProblemas: 25, semFabrica: 25, semImagem: 0, semCategoria: 0, duplicados: 0, inativos: 0, estoqueZerado: 25, criticos: 25, medios: 0, leves: 0 }
        };
      }
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
  assert.ok(root.textContent.includes('Inativos'));
  const row = root.querySelector('.nha-row');
  row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await flush();
  assert.equal(window.location.hash, '#/produtos/p1');

  assert.ok(root.textContent.includes('Total produtos'));
  assert.ok(root.textContent.includes('25'));
  assert.ok(root.textContent.includes('Página 1 de 2'));
  assert.equal(root.querySelectorAll('.nha-row').length, 20);

  root.querySelector('#nha-next').click();
  await flush();
  assert.ok(root.textContent.includes('Página 2 de 2'));
  assert.equal(root.querySelectorAll('.nha-row').length, 5);
  teardownFrontendDom(dom);
});
