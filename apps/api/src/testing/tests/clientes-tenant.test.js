import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role, accountId, userId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (userId) headers['x-test-user-id'] = userId;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getClientesTenantTests() {
  return [
    {
      name: 'GET /clientes sales sem accountId retorna 403 TENANT_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/clientes', role: 'sales' });
        assertEqual(res.statusCode, 403, 'deve bloquear sem tenant');
        assertEqual(body.error.code, 'TENANT_REQUIRED', 'code esperado');
      }
    },
    {
      name: 'POST /clientes admin sem accountId retorna 403 TENANT_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'POST', url: '/clientes', role: 'admin', body: { nome: 'Sem tenant' } });
        assertEqual(res.statusCode, 403, 'deve bloquear sem tenant');
        assertEqual(body.error.code, 'TENANT_REQUIRED', 'code esperado');
      }
    },
    {
      name: 'POST /clientes admin com account cria com account_id correto',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-a', body: { nome: 'Cliente A' } });
        assertEqual(res.statusCode, 200, 'deve criar');
        assertEqual(body.item.account_id, 'acc-a', 'account_id deve vir do contexto');
      }
    },
    {
      name: 'GET /clientes account A nao enxerga account B',
      run: async () => {
        const app = createApiApp();
        await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-a', body: { nome: 'Cliente A' } });
        await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-b', body: { nome: 'Cliente B' } });
        const { body } = await call(app, { method: 'GET', url: '/clientes', role: 'sales', accountId: 'acc-a' });
        assertEqual(body.items.every((item) => item.account_id === 'acc-a'), true, 'somente account A');
      }
    },
    {
      name: 'GET /clientes/:id manager busca cliente de qualquer vendedor do tenant',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-tenant', userId: 'admin-1', body: { nome: 'Cliente Manager', owner_user_id: 'sales-b' } });
        const got = await call(app, { method: 'GET', url: `/clientes/${created.body.item.id}`, role: 'manager', accountId: 'acc-tenant', userId: 'mgr-1' });
        assertEqual(got.res.statusCode, 200);
        assertEqual(got.body.item.id, created.body.item.id);
      }
    },
    {
      name: 'GET /clientes/:id sales so acessa cliente proprio',
      run: async () => {
        const app = createApiApp();
        const own = await call(app, { method: 'POST', url: '/clientes', role: 'sales', accountId: 'acc-own', userId: 'sales-a', body: { nome: 'Meu Cliente' } });
        const other = await call(app, { method: 'POST', url: '/clientes', role: 'sales', accountId: 'acc-own', userId: 'sales-b', body: { nome: 'Cliente B' } });
        const ok = await call(app, { method: 'GET', url: `/clientes/${own.body.item.id}`, role: 'sales', accountId: 'acc-own', userId: 'sales-a' });
        assertEqual(ok.res.statusCode, 200);
        const denied = await call(app, { method: 'GET', url: `/clientes/${other.body.item.id}`, role: 'sales', accountId: 'acc-own', userId: 'sales-a' });
        assertEqual(denied.res.statusCode, 404);
      }
    },
    {
      name: 'GET /clientes/:id nao permite acesso cross-tenant',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-a', userId: 'admin-a', body: { nome: 'Cliente A' } });
        const salesCross = await call(app, { method: 'GET', url: `/clientes/${created.body.item.id}`, role: 'sales', accountId: 'acc-b', userId: 'sales-b' });
        assertEqual(salesCross.res.statusCode, 404);
        const managerCross = await call(app, { method: 'GET', url: `/clientes/${created.body.item.id}`, role: 'manager', accountId: 'acc-b', userId: 'mgr-b' });
        assertEqual(managerCross.res.statusCode, 404);
      }
    },
    {
      name: 'GET /clientes/:id inexistente retorna NOT_FOUND',
      run: async () => {
        const app = createApiApp();
        const out = await call(app, { method: 'GET', url: '/clientes/inexistente-id', role: 'manager', accountId: 'acc-z', userId: 'mgr-z' });
        assertEqual(out.res.statusCode, 404);
        assertEqual(out.body.error.code, 'CLIENTE_NOT_FOUND');
      }
    },
    {
      name: 'body account_id malicioso deve ser ignorado',
      run: async () => {
        const app = createApiApp();
        const { body } = await call(app, {
          method: 'POST',
          url: '/clientes',
          role: 'admin',
          accountId: 'acc-safe',
          body: { nome: 'Cliente Seguro', account_id: 'acc-malicioso' }
        });
        assertEqual(body.item.account_id, 'acc-safe', 'deve priorizar accountId do contexto');
      }
    }
  ];
}
