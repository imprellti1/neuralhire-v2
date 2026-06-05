import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';

function parseBody(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }
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

export function getVendedoresTests() {
  return [
    { name: 'admin cria vendedor', run: async () => { const app = createApiApp(); const out = await call(app, { method: 'POST', url: '/vendedores', role: 'admin', accountId: 'acc-1', body: { nome: 'Vendedor 1' } }); assertEqual(out.res.statusCode, 200); assertEqual(out.body.item.nome, 'Vendedor 1'); } },
    { name: 'admin vincula vendedor a multiplas fabricas', run: async () => { const app = createApiApp(); await call(app, { method: 'POST', url: '/fabricantes', role: 'admin', accountId: 'acc-1', body: { nome: 'Fab A', cnpj: '12345678000190' } }); await call(app, { method: 'POST', url: '/fabricantes', role: 'admin', accountId: 'acc-1', body: { nome: 'Fab B', cnpj: '22345678000190' } }); const vendedor = await call(app, { method: 'POST', url: '/vendedores', role: 'admin', accountId: 'acc-1', body: { nome: 'Vend', fabricante_ids: [] } }); const out = await call(app, { method: 'PUT', url: `/vendedores/${vendedor.body.item.id}/fabricantes`, role: 'admin', accountId: 'acc-1', body: { fabricante_ids: [] } }); assertEqual(out.res.statusCode, 200); } },
    { name: 'vendedor comum nao cria vendedor', run: async () => { const app = createApiApp(); const out = await call(app, { method: 'POST', url: '/vendedores', role: 'sales', accountId: 'acc-1', userId: 'sales-1', body: { nome: 'Bloqueado' } }); assertEqual(out.res.statusCode, 403); } }
  ];
}
