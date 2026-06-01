import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role, body, accountId }) {
  const headers = { 'x-test-role': role || '' };
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getScopesTests() {
  const accountId = 'acc-scopes';

  return [
    {
      name: 'sales acessa GET /clientes permitido',
      run: async () => {
        const app = createApiApp();
        const { res } = await call(app, { method: 'GET', url: '/clientes', role: 'sales', accountId });
        assertEqual(res.statusCode, 200, 'sales deveria acessar GET /clientes');
      }
    },
    {
      name: 'viewer acessa GET /clientes permitido',
      run: async () => {
        const app = createApiApp();
        const { res } = await call(app, { method: 'GET', url: '/clientes', role: 'viewer', accountId });
        assertEqual(res.statusCode, 200, 'viewer deveria acessar GET /clientes');
      }
    },
    {
      name: 'viewer acessa POST /clientes retorna 403',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'POST', url: '/clientes', role: 'viewer', accountId, body: { nome: 'A B' } });
        assertEqual(res.statusCode, 403, 'viewer deveria ser bloqueado');
        assertEqual(body.error.code, 'FORBIDDEN_PERMISSION', 'Code esperado FORBIDDEN_PERMISSION');
      }
    },
    {
      name: 'admin acessa POST /clientes permitido',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente Admin' } });
        assertEqual(res.statusCode, 200, 'admin deveria criar cliente');
        assertEqual(body.ok, true, 'ok esperado true');
      }
    },
    {
      name: 'super_admin acessa tudo permitido',
      run: async () => {
        const app = createApiApp();
        const get = await call(app, { method: 'GET', url: '/clientes', role: 'super_admin', accountId });
        const post = await call(app, { method: 'POST', url: '/clientes', role: 'super_admin', accountId, body: { nome: 'Cliente SA' } });
        assertEqual(get.res.statusCode, 200, 'super_admin get');
        assertEqual(post.res.statusCode, 200, 'super_admin post');
      }
    }
  ];
}