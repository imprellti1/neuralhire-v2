import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryProdutos, __resetMemoryProdutosForTests, createProduto, listProdutoVariacoes } from '../../modules/produtos/produtos.repository.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const req = createTestRequest({ method, url, headers, body: payload });
  const res = createTestResponse();
  return app(req, res).then(() => ({ res, body: parseBody(res) }));
}

export function getProdutosVariacoesTests() {
  return [
    {
      name: 'listProdutoVariacoes respeita tenant e produto',
      run: async () => {
        __resetMemoryProdutosForTests();
        const created = await createProduto({ nome: 'Produto V', sku: 'SKU-V' }, { accountId: 'acc-a' });
        const items = await listProdutoVariacoes(created.id, { accountId: 'acc-a' });
        assert.equal(Array.isArray(items), true);
        assert.equal(items.length, 0);
        await assert.rejects(() => listProdutoVariacoes(created.id, { accountId: 'acc-b' }));
      }
    },
    {
      name: 'GET /produtos/:id/variacoes existe e responde no Produto 360',
      run: async () => {
        __resetMemoryProdutosForTests();
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-a', body: { nome: 'Produto API', sku: 'SKU-API' } });
        const out = await call(app, { method: 'GET', url: `/produtos/${created.body.item.id}/variacoes`, role: 'admin', accountId: 'acc-a' });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(Array.isArray(out.body.items), true);
      }
    },
    {
      name: 'GET /produtos/:produtoId/variacoes inclui variacoes ativas e inativas',
      run: async () => {
        __resetMemoryProdutosForTests();
        const produtoId = 'produto-1';
        __loadMemoryProdutos([{
          id: produtoId,
          account_id: 'acc-a',
          nome: 'Produto com variações',
          variacoes: [
            { id: 'v1', account_id: 'acc-a', produto_id: produtoId, sku: 'SKU-1', nome: 'V1', valor: 0, cor: 'Azul', grade: 'P', estoque_atual: 2, preco: 10, ativo: true, imagem_url: null, imagem_path: null },
            { id: 'v2', account_id: 'acc-a', produto_id: produtoId, sku: 'SKU-2', nome: 'V2', valor: 0, cor: 'Preto', grade: 'M', estoque_atual: 0, preco: 12, ativo: false, imagem_url: null, imagem_path: null }
          ]
        }]);
        const items = await listProdutoVariacoes(produtoId, { accountId: 'acc-a' });
        assert.equal(items.length, 2);
        assert.equal(items.some((item) => item.ativo === false), true);
      }
    },
    {
      name: 'POST /produto-variacoes/:variacaoId/imagem bloqueia cross-tenant e 404 seguro',
      run: async () => {
        __resetMemoryProdutosForTests();
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-a', body: { nome: 'Produto API', sku: 'SKU-API' } });

        const crossTenant = await call(app, {
          method: 'POST',
          url: `/produto-variacoes/nao-existe/imagem`,
          role: 'admin',
          accountId: 'acc-b',
          body: { upload: { fileName: 'foto.png', mimeType: 'image/png', base64: 'aGVsbG8=', size: 5 } }
        });
        assert.equal(crossTenant.res.statusCode, 404);
        assert.equal(crossTenant.body.error.code, 'VARIACAO_NOT_FOUND');

        const safe404 = await call(app, {
          method: 'POST',
          url: `/produto-variacoes/${created.body.item.id}/imagem`,
          role: 'admin',
          accountId: 'acc-a',
          body: { upload: { fileName: 'foto.png', mimeType: 'image/png', base64: 'aGVsbG8=', size: 5 } }
        });
        assert.equal(safe404.res.statusCode, 404);
      }
    }
  ];
}
