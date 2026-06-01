import { createApiApp } from '../../app.js';
import { assertEqual } from '../assert.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryProdutosForTests, createProduto, searchProdutos } from '../../modules/produtos/produtos.repository.js';

const accountId = 'acc-prod-search';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role, accountId: tenant, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (tenant) headers['x-test-account-id'] = tenant;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getProdutosSearchTests() {
  return [
    {
      name: 'busca por nome',
      run: async () => {
        __resetMemoryProdutosForTests();
        await createProduto({ nome: 'Toalha Appel Premium' }, { accountId });
        const result = await searchProdutos('toalha', { accountId });
        assertEqual(result.total > 0, true);
      }
    },
    {
      name: 'busca por sku',
      run: async () => {
        __resetMemoryProdutosForTests();
        await createProduto({ nome: 'X', sku: 'APP-001' }, { accountId });
        const result = await searchProdutos('APP-001', { accountId });
        assertEqual(result.total, 1);
      }
    },
    {
      name: 'busca por marca e categoria',
      run: async () => {
        __resetMemoryProdutosForTests();
        await createProduto({ nome: 'Y', marca: 'Appel', categoria: 'banho' }, { accountId });
        const byBrand = await searchProdutos('appel', { accountId });
        const byCategory = await searchProdutos('banho', { accountId });
        assertEqual(byBrand.total > 0, true);
        assertEqual(byCategory.total > 0, true);
      }
    },
    {
      name: 'busca vazia retorna zero',
      run: async () => {
        __resetMemoryProdutosForTests();
        const result = await searchProdutos('', { accountId });
        assertEqual(result.total, 0);
      }
    },
    {
      name: 'ranking simples prioriza nome exato',
      run: async () => {
        __resetMemoryProdutosForTests();
        await createProduto({ nome: 'Appel', descricao: 'produto geral' }, { accountId });
        await createProduto({ nome: 'Produto X', descricao: 'marca appel especial' }, { accountId });
        const result = await searchProdutos('appel', { accountId });
        assertEqual(result.items[0].nome, 'Appel');
      }
    },
    {
      name: 'GET /produtos/search?q=appel retorna query e resultados',
      run: async () => {
        __resetMemoryProdutosForTests();
        const app = createApiApp();
        await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-http', body: { nome: 'Toalha Appel Premium', sku: 'APP-001' } });
        const { res, body } = await call(app, { method: 'GET', url: '/produtos/search?q=appel', role: 'sales', accountId: 'acc-http' });
        assertEqual(res.statusCode, 200);
        assertEqual(body.ok, true);
        assertEqual(body.query, 'appel');
        assertEqual(body.total > 0, true);
      }
    },
    {
      name: 'GET /produtos/search?search=appel retorna query',
      run: async () => {
        __resetMemoryProdutosForTests();
        const app = createApiApp();
        await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-http', body: { nome: 'Toalha Appel Premium' } });
        const { body } = await call(app, { method: 'GET', url: '/produtos/search?search=appel', role: 'sales', accountId: 'acc-http' });
        assertEqual(body.query, 'appel');
      }
    },
    {
      name: 'GET /produtos/search sem query retorna query vazia',
      run: async () => {
        __resetMemoryProdutosForTests();
        const app = createApiApp();
        const { body } = await call(app, { method: 'GET', url: '/produtos/search', role: 'sales', accountId: 'acc-http' });
        assertEqual(body.query, '');
        assertEqual(body.total, 0);
      }
    }
  ];
}