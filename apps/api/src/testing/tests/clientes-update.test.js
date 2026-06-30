import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';

function parseBody(res) {
  try {
    return JSON.parse(res.body || '{}');
  } catch {
    return {};
  }
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

export function getClientesUpdateTests() {
  return [
    {
      name: 'PATCH /clientes/:id atualiza campos principais',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-1', body: { nome: 'Cliente A', cidade: 'São Paulo', estado: 'SP', status: 'ativo' } });
        const updated = await call(app, {
          method: 'PATCH',
          url: `/clientes/${created.body.item.id}`,
          role: 'admin',
          accountId: 'acc-1',
          body: { nome: 'Cliente A Ltda', razao_social: 'Cliente A LTDA', cidade: 'Curitiba', estado: 'PR', status: 'prospect', documento: '00.000.000/0001-00', telefone: '(41) 99999-0000', email: 'contato@exemplo.com', vendedor_id: 'vend-1' }
        });

        assertEqual(updated.res.statusCode, 200);
        assertEqual(updated.body.item.nome, 'Cliente A Ltda');
        assertEqual(updated.body.item.razao_social, 'Cliente A LTDA');
        assertEqual(updated.body.item.cidade, 'Curitiba');
        assertEqual(updated.body.item.estado, 'PR');
        assertEqual(updated.body.item.status, 'prospect');
        assertEqual(updated.body.item.vendedor_id, 'vend-1');
      }
    },
    {
      name: 'PATCH /clientes/:id preserva tenant e respeita scope do vendedor',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-1', body: { nome: 'Cliente B', vendedor_id: 'vend-a' } });
        const forbidden = await call(app, { method: 'PATCH', url: `/clientes/${created.body.item.id}`, role: 'sales', accountId: 'acc-1', userId: 'vend-b', body: { cidade: 'Recife' } });
        assertEqual(forbidden.res.statusCode, 404);
      }
    }
  ];
}
