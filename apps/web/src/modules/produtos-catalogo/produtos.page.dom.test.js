import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProdutosPage } from './produtos.page.js';
import { resetProdutosState } from './produtos.state.js';
import { dispatchInput, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('listagem de produtos mostra fábrica e fallback', async () => {
  resetProdutosState();
  const dom = setupFrontendDom('#/produtos');
  let calls = 0;
  const queries = [];
  const apiClient = {
    async get(path, query) {
      calls += 1;
      queries.push({ path, query });
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

  const search = root.querySelector('#nhp-search');
  dispatchInput(search, 'to');
  dispatchInput(search, 'toalha');
  dispatchInput(search, 'toalha banho');
  assert.equal(search.value, 'toalha banho');
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(calls, 1);
  await new Promise((resolve) => setTimeout(resolve, 220));
  await flush();
  await flush();
  assert.equal(root.querySelector('#nhp-search').value, 'toalha banho');
  assert.equal(calls, 2);
  assert.deepEqual(queries[1].query, { page: 1, limit: 10, search: 'toalha banho' });
  teardownFrontendDom(dom);
});

test('listagem de produtos destaca variação em promoção e mostra status corretamente', async () => {
  resetProdutosState();
  const dom = setupFrontendDom('#/produtos');
  const apiClient = {
    async get(path) {
      if (path === '/produtos') {
        return {
          items: [
            { id: 'p1', nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', fabricante_nome: 'Fábrica 1', preco: 10, status: 'ativo', ativo: true, tem_promocao_variacao: true, created_at: '2026-01-01T00:00:00.000Z' },
            { id: 'p2', nome: 'Produto 2', sku: 'SKU2', categoria: 'Cat', preco: 10, status: 'inativo', ativo: false, created_at: '2026-01-02T00:00:00.000Z' }
          ],
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
        };
      }
      throw new Error(`unhandled get ${path}`);
    }
  };

  const root = document.getElementById('root');
  renderProdutosPage(root, { apiClient });
  await flush(); await flush();

  assert.equal(root.querySelectorAll('.nhp-row-link.is-promo-variation').length, 1);
  assert.match(root.textContent, /Ativo/);
  assert.match(root.textContent, /Inativo/);
  assert.doesNotMatch(root.textContent, /-\\s*$/);

  teardownFrontendDom(dom);
});

test('listagem de produtos mostra overlay global durante carregamento e remove ao concluir ou falhar', async () => {
  resetProdutosState();
  const dom = setupFrontendDom('#/produtos');
  let resolveGet;
  const apiClient = {
    async get(path) {
      if (path === '/produtos') {
        return await new Promise((resolve, reject) => {
          resolveGet = resolve;
          setTimeout(() => resolve({ items: [{ id: 'p1', nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, status: 'ativo', created_at: '2026-01-01T00:00:00.000Z' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }), 10);
        });
      }
      throw new Error(`unhandled get ${path}`);
    }
  };

  const root = document.getElementById('root');
  renderProdutosPage(root, { apiClient });
  await flush();
  assert.ok(document.querySelector('.nh-global-processing'));
  assert.match(document.body.textContent, /Carregando produtos/);

  await new Promise((resolve) => setTimeout(resolve, 20));
  await flush();
  await flush();
  assert.equal(document.querySelector('.nh-global-processing')?.hidden, true);
  assert.match(root.textContent, /Produto 1/);

  const failingClient = {
    async get(path) {
      if (path === '/produtos') throw new Error('boom');
      throw new Error(`unhandled get ${path}`);
    }
  };
  renderProdutosPage(root, { apiClient: failingClient });
  await flush();
  assert.ok(document.querySelector('.nh-global-processing'));
  await flush();
  await flush();
  assert.equal(root.textContent.includes('Não foi possível carregar os produtos.'), true);
  assert.equal(document.querySelector('.nh-global-processing')?.hidden, true);

  teardownFrontendDom(dom);
});
