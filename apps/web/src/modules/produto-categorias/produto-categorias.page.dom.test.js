import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProdutoCategoriasPage } from './produto-categorias.page.js';
import { dispatchInput, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('rota de categorias renderiza CRUD e usa payload seguro', async () => {
  const dom = setupFrontendDom('#/produto-categorias');
  const calls = [];
  const apiClient = {
    async get(path) {
      if (path === '/produto-categorias') return { items: [{ id: 'c1', nome: 'Mesa Posta', slug: 'mesa-posta', status: 'ativo', descricao: 'Itens', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z' }, { id: 'c2', nome: 'Linha Inativa', slug: 'linha-inativa', status: 'inativo', parent_nome: 'Mesa Posta' }] };
      throw new Error(`unhandled get ${path}`);
    },
    async post(path, payload) { calls.push(['post', path, payload]); return { item: { id: 'c3' } }; },
    async patch(path, payload) { calls.push(['patch', path, payload]); return { item: { id: 'c1' } }; },
    async delete(path) { calls.push(['delete', path]); return { item: { id: 'c1' } }; }
  };
  const root = document.getElementById('root');
  renderProdutoCategoriasPage(root, { apiClient });
  await flush(); await flush();
  assert.match(root.textContent, /Mesa Posta/);
  assert.match(root.textContent, /linha-inativa/);
  root.querySelector('#nhpc-new').click();
  await flush();
  root.querySelector('#nhpc-nome').value = 'Nova Categoria';
  root.querySelector('#nhpc-nome').dispatchEvent(new Event('input', { bubbles: true }));
  root.querySelector('#nhpc-save').click();
  await flush(); await flush();
  const post = calls.find((entry) => entry[0] === 'post');
  assert.deepEqual(Object.keys(post[2]).sort(), ['descricao', 'nome', 'parent_id', 'status']);
  assert.equal(post[2][['account', 'id'].join('_')], undefined);
  assert.equal(post[2][['tenant', 'id'].join('_')], undefined);

  const search = root.querySelector('#nhpc-search');
  dispatchInput(search, 'to');
  dispatchInput(search, 'toa');
  dispatchInput(search, 'toalha banho');
  await flush();
  await flush();
  assert.equal(root.querySelector('#nhpc-search').value, 'toalha banho');
  teardownFrontendDom(dom);
});
