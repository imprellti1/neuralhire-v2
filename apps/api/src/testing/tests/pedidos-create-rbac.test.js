import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

function parseBody(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }
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

async function seed(app, accountId) {
  const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente RBAC Pedido' } });
  const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId, body: { nome: 'Produto RBAC Pedido', preco: 25 } });
  return { clienteId: cliente.body.item.id, produtoId: produto.body.item.id };
}

export function getPedidosCreateRbacTests() {
  return [
    {
      name: 'POST /pedidos com manager permitido',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-pedidos-manager';
        const data = await seed(app, accountId);
        const out = await call(app, { method: 'POST', url: '/pedidos', role: 'manager', accountId, body: { cliente_id: data.clienteId, itens: [{ produto_id: data.produtoId, quantidade: 2, preco_unitario: 9999 }] } });
        assertEqual(out.res.statusCode, 200);
        assertEqual(out.body.ok, true);
      }
    },
    {
      name: 'POST /pedidos sem permissao continua bloqueado',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-pedidos-viewer';
        const data = await seed(app, accountId);
        const out = await call(app, { method: 'POST', url: '/pedidos', role: 'viewer', accountId, body: { cliente_id: data.clienteId, itens: [{ produto_id: data.produtoId, quantidade: 1 }] } });
        assertEqual(out.res.statusCode, 403);
        assertEqual(out.body.error.code, 'FORBIDDEN_PERMISSION');
      }
    },
    {
      name: 'POST /pedidos preserva account_id do contexto e ignora body malicioso',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-pedidos-safe';
        const data = await seed(app, accountId);
        const out = await call(app, { method: 'POST', url: '/pedidos', role: 'manager', accountId, body: { account_id: 'acc-evil', cliente_id: data.clienteId, itens: [{ produto_id: data.produtoId, quantidade: 1 }] } });
        assertEqual(out.res.statusCode, 200);
        assertEqual(out.body.pedido.account_id, accountId);
      }
    },
    {
      name: 'POST /pedidos recalcula total no backend',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-pedidos-total';
        const data = await seed(app, accountId);
        const out = await call(app, { method: 'POST', url: '/pedidos', role: 'manager', accountId, body: { cliente_id: data.clienteId, itens: [{ produto_id: data.produtoId, quantidade: 2, preco_unitario: 0, desconto: 0 }] } });
        assertEqual(out.res.statusCode, 200);
        const precoUnitario = Number(out.body.itens?.[0]?.preco_unitario ?? 0);
        assertEqual(out.body.pedido.total, precoUnitario * 2);
        assertEqual(precoUnitario > 0, true);
      }
    },
    {
      name: 'POST /pedidos ignora preco_unitario enviado no frontend e usa preco do produto',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-pedidos-price-source';
        const data = await seed(app, accountId);
        const out = await call(app, { method: 'POST', url: '/pedidos', role: 'manager', accountId, body: { cliente_id: data.clienteId, itens: [{ produto_id: data.produtoId, quantidade: 1, preco_unitario: 0.01 }] } });
        assertEqual(out.res.statusCode, 200);
        assertEqual(Number(out.body.itens?.[0]?.preco_unitario ?? 0), 25);
        assertEqual(Number(out.body.pedido?.total ?? 0), 25);
      }
    }
  ];
}

