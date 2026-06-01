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

async function seedClienteEProduto(app, accountId) {
  const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente Pedido' } });
  const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId, body: { nome: 'Produto Pedido', sku: 'PP-1' } });
  return { clienteId: cliente.body.item.id, produtoId: produto.body.item.id };
}

export function getPedidosTenantTests() {
  return [
    {
      name: 'tenant obrigatorio em GET /pedidos',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/pedidos', role: 'sales' });
        assertEqual(res.statusCode, 403);
        assertEqual(body.error.code, 'TENANT_REQUIRED');
      }
    },
    {
      name: 'isolamento account_id em pedidos',
      run: async () => {
        const app = createApiApp();
        const a = await seedClienteEProduto(app, 'acc-a');
        const b = await seedClienteEProduto(app, 'acc-b');

        await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: 'acc-a', body: { cliente_id: a.clienteId, itens: [{ produto_id: a.produtoId, quantidade: 1, preco_unitario: 10 }] } });
        await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: 'acc-b', body: { cliente_id: b.clienteId, itens: [{ produto_id: b.produtoId, quantidade: 1, preco_unitario: 10 }] } });

        const listA = await call(app, { method: 'GET', url: '/pedidos', role: 'sales', accountId: 'acc-a' });
        assertEqual(listA.body.items.every((item) => item.account_id === 'acc-a'), true);
      }
    },
    {
      name: 'body malicioso account_id ignorado',
      run: async () => {
        const app = createApiApp();
        const seeded = await seedClienteEProduto(app, 'acc-safe');
        const created = await call(app, {
          method: 'POST',
          url: '/pedidos',
          role: 'admin',
          accountId: 'acc-safe',
          body: { account_id: 'acc-bad', cliente_id: seeded.clienteId, itens: [{ produto_id: seeded.produtoId, quantidade: 1, preco_unitario: 20 }] }
        });
        assertEqual(created.body.pedido.account_id, 'acc-safe');
      }
    }
  ];
}