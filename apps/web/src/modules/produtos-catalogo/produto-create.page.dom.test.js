import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProdutoCreatePage } from './produto-create.page.js';
import { dispatchChange, dispatchInput, findButtonByText, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('cadastro de produto carrega fábricas e envia fabricante_id', async () => {
  const dom = setupFrontendDom('#/produtos/novo');
  let posted = null;
  const apiClient = {
    async get(path) {
      if (path === '/fabricantes') return { items: [{ id: 'fab-1', nome: 'Fábrica 1' }] };
      throw new Error(`unhandled get ${path}`);
    },
    async post(path, payload) {
      posted = { path, payload };
      return { item: { id: 'p1' } };
    }
  };

  const root = document.getElementById('root');
  renderProdutoCreatePage(root, { apiClient });
  await flush(); await flush();
  assert.ok(root.querySelector('#fabricante_id'));
  dispatchInput(root.querySelector('#nome'), 'Produto Novo');
  dispatchInput(root.querySelector('#preco'), '10,00');
  dispatchChange(root.querySelector('#fabricante_id'), 'fab-1');
  findButtonByText('Salvar Produto').click();
  await flush(); await flush();
  assert.equal(posted.path, '/produtos');
  assert.equal(posted.payload.fabricante_id, 'fab-1');
  const sensitiveFields = [['account', 'id'].join('_'), ['tenant', 'id'].join('_'), ['owner', 'user', 'id'].join('_')];
  assert.equal(sensitiveFields.some((field) => field in posted.payload), false);
  teardownFrontendDom(dom);
});
