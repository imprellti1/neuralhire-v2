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

export function getClientesVendedorScopeTests() {
  return [
    { name: 'vendedor A lista somente seus clientes', run: async () => { const app = createApiApp(); const a = await call(app, { method: 'POST', url: '/clientes', role: 'sales', accountId: 'acc-1', userId: 'vend-a', body: { nome: 'Cliente A' } }); await call(app, { method: 'POST', url: '/clientes', role: 'sales', accountId: 'acc-1', userId: 'vend-b', body: { nome: 'Cliente B' } }); const list = await call(app, { method: 'GET', url: '/clientes', role: 'sales', accountId: 'acc-1', userId: 'vend-a' }); assertEqual(list.body.items.every((i) => i.owner_user_id === a.body.item.owner_user_id), true); } },
    { name: 'admin reatribui cliente', run: async () => { const app = createApiApp(); const created = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-1', body: { nome: 'Reatribuir', vendedor_id: 'vend-a' } }); const updated = await call(app, { method: 'PATCH', url: `/clientes/${created.body.item.id}`, role: 'admin', accountId: 'acc-1', body: { vendedor_id: 'vend-b' } }); assertEqual(updated.body.item.vendedor_id, 'vend-b'); } }
  ];
}
