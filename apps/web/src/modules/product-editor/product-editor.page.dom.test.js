import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProductEditorPage } from './product-editor.page.js';
import { dispatchInput, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('product editor renderiza lista, editor e salva sem campos sensiveis', async () => {
  const dom = setupFrontendDom('#/product-editor');
  let patchCalls = [];
  const apiClient = {
    async get(path) {
      if (path === '/produtos') return { items: [{ id: 'p1', nome: 'Produto 1', sku: 'SKU1', fabricante: { nome: 'Fab 1' }, status: 'ativo' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } };
      if (path === '/produtos/p1') return { id: 'p1', nome: 'Produto 1', sku: 'SKU1', imagemUrl: 'https://img.test/a.jpg' };
      if (path === '/product-editor/products/p1/variations') return { items: [{ id: 'v1', sku: 'VAR1', cor: 'Azul', tamanho: 'M', estoque: 1, preco: 10, imagemUrl: '', ativo: true }] };
      throw new Error(path);
    },
    async patch(path, body) { patchCalls.push({ path, body }); return { id: 'p1', ...body }; },
    async post(path, body) { patchCalls.push({ path, body }); return { id: 'v2', ...body }; }
  };
  const root = document.getElementById('root');
  renderProductEditorPage(root, { apiClient });
  await flush(); await flush();
  assert.match(document.body.textContent, /Editor de Produtos/);
  root.querySelector('.npe-card').click();
  await flush(); await flush();
  dispatchInput(root.querySelector('#pe-nome'), 'Produto Editado');
  root.querySelector('#pe-save').click();
  await flush(); await flush();
  assert.ok(patchCalls.some((call) => call.path === '/produtos/p1'));
  teardownFrontendDom(dom);
});
