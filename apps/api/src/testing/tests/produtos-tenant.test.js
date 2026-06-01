import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getProdutosTenantTests() {
  return [
    {
      name: 'GET /produtos sem tenant retorna TENANT_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/produtos', role: 'sales' });
        assertEqual(res.statusCode, 403);
        assertEqual(body.error.code, 'TENANT_REQUIRED');
      }
    },
    {
      name: 'POST /produtos ignora account_id malicioso',
      run: async () => {
        const app = createApiApp();
        const { body } = await call(app, {
          method: 'POST',
          url: '/produtos',
          role: 'admin',
          accountId: 'acc-safe',
          body: { nome: 'Produto Seguro', account_id: 'acc-bad' }
        });
        assertEqual(body.item.account_id, 'acc-safe');
      }
    },
    {
      name: 'PATCH /produtos/:id atualiza campos permitidos no mesmo tenant',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-patch', body: { nome: 'Produto X', preco: 10 } });
        const updated = await call(app, { method: 'PATCH', url: `/produtos/${created.body.item.id}`, role: 'admin', accountId: 'acc-patch', body: { nome: 'Produto Y', preco: 20, status: 'inativo' } });
        assertEqual(updated.res.statusCode, 200);
        assertEqual(updated.body.item.nome, 'Produto Y');
        assertEqual(updated.body.item.preco, 20);
        assertEqual(updated.body.item.ativo, false);
      }
    },
    {
      name: 'PATCH /produtos/:id ignora campos maliciosos de tenant/owner',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-safe', body: { nome: 'Produto Safe', preco: 10 } });
        const updated = await call(app, { method: 'PATCH', url: `/produtos/${created.body.item.id}`, role: 'admin', accountId: 'acc-safe', body: { account_id: 'acc-evil', owner_user_id: 'evil', tenant_id: 'evil', nome: 'Produto Safe 2' } });
        assertEqual(updated.res.statusCode, 200);
        assertEqual(updated.body.item.account_id, 'acc-safe');
      }
    },
    {
      name: 'PATCH /produtos/:id outro tenant retorna NOT_FOUND seguro',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-a', body: { nome: 'Produto A', preco: 10 } });
        const out = await call(app, { method: 'PATCH', url: `/produtos/${created.body.item.id}`, role: 'admin', accountId: 'acc-b', body: { nome: 'Hack' } });
        assertEqual(out.res.statusCode, 404);
        assertEqual(out.body.error.code, 'PRODUTO_NOT_FOUND');
      }
    },
    {
      name: 'PATCH /produtos/:id valida preco e status',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-val', body: { nome: 'Produto V', preco: 10 } });
        const invalidPrice = await call(app, { method: 'PATCH', url: `/produtos/${created.body.item.id}`, role: 'admin', accountId: 'acc-val', body: { preco: 0 } });
        assertEqual(invalidPrice.res.statusCode, 400);
        const invalidStatus = await call(app, { method: 'PATCH', url: `/produtos/${created.body.item.id}`, role: 'admin', accountId: 'acc-val', body: { status: 'bloqueado' } });
        assertEqual(invalidStatus.res.statusCode, 400);
      }
    },
    {
      name: 'isolamento produtos por account_id',
      run: async () => {
        const app = createApiApp();
        await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-a', body: { nome: 'Prod A' } });
        await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-b', body: { nome: 'Prod B' } });
        const { body } = await call(app, { method: 'GET', url: '/produtos', role: 'sales', accountId: 'acc-a' });
        assertEqual(body.items.every((item) => item.account_id === 'acc-a'), true);
      }
    }
  ];
}
