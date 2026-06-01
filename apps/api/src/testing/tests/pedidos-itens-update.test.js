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

export function getPedidosItensUpdateTests() {
  return [
    {
      name: 'atualiza quantidade, adiciona e remove item com recálculo',
      run: async () => {
        const app = createApiApp();
        const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-edit', body: { nome: 'Cliente E' } });
        const p1 = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-edit', body: { nome: 'Produto A', preco: 10 } });
        const p2 = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-edit', body: { nome: 'Produto B', preco: 20 } });
        const create = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: 'acc-edit', body: { cliente_id: cliente.body.item.id, status: 'aprovado', itens: [{ produto_id: p1.body.item.id, quantidade: 1, preco_unitario: 999 }] } });
        const pedidoId = create.body.pedido.id;

        const patch = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoId}/itens`, role: 'admin', accountId: 'acc-edit', body: { itens: [{ produto_id: p1.body.item.id, quantidade: 3, desconto: 0 }, { produto_id: p2.body.item.id, quantidade: 1, desconto: 0 }] } });
        assertEqual(patch.res.statusCode, 200);
        assertEqual(patch.body.pedido.status, 'aprovado');
        assertEqual(patch.body.itens.length, 2);
        assertEqual(patch.body.pedido.subtotal, 50);
        assertEqual(patch.body.pedido.total, 50);
      }
    },
    {
      name: 'rejeita produto de outro tenant',
      run: async () => {
        const app = createApiApp();
        const clienteA = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-edit-a', body: { nome: 'Cliente A' } });
        const produtoA = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-edit-a', body: { nome: 'Produto A' } });
        const produtoB = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-edit-b', body: { nome: 'Produto B' } });
        const created = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: 'acc-edit-a', body: { cliente_id: clienteA.body.item.id, itens: [{ produto_id: produtoA.body.item.id, quantidade: 1, preco_unitario: 1 }] } });
        const out = await call(app, { method: 'PATCH', url: `/pedidos/${created.body.pedido.id}/itens`, role: 'admin', accountId: 'acc-edit-a', body: { itens: [{ produto_id: produtoB.body.item.id, quantidade: 1 }] } });
        assertEqual(out.res.statusCode, 404);
      }
    },
    {
      name: 'rejeita quantidade inválida e body malicioso',
      run: async () => {
        const app = createApiApp();
        const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-q', body: { nome: 'Cliente Q' } });
        const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-q', body: { nome: 'Produto Q' } });
        const created = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: 'acc-q', body: { cliente_id: cliente.body.item.id, itens: [{ produto_id: produto.body.item.id, quantidade: 1, preco_unitario: 10 }] } });
        const badQty = await call(app, { method: 'PATCH', url: `/pedidos/${created.body.pedido.id}/itens`, role: 'admin', accountId: 'acc-q', body: { itens: [{ produto_id: produto.body.item.id, quantidade: 0 }] } });
        assertEqual(badQty.res.statusCode, 400);

        const malicious = await call(app, { method: 'PATCH', url: `/pedidos/${created.body.pedido.id}/itens`, role: 'admin', accountId: 'acc-q', body: { account_id: 'acc-x', itens: [{ produto_id: produto.body.item.id, quantidade: 2, preco_unitario: 99999 }] } });
        assertEqual(malicious.res.statusCode, 200);
        assertEqual(malicious.body.pedido.account_id, 'acc-q');
      }
    },
    {
      name: 'mantém isolamento multi-tenant no update de itens',
      run: async () => {
        const app = createApiApp();
        const clienteA = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-a1', body: { nome: 'Cliente A1' } });
        const produtoA = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: 'acc-a1', body: { nome: 'Produto A1' } });
        const created = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: 'acc-a1', body: { cliente_id: clienteA.body.item.id, itens: [{ produto_id: produtoA.body.item.id, quantidade: 1, preco_unitario: 5 }] } });
        const out = await call(app, { method: 'PATCH', url: `/pedidos/${created.body.pedido.id}/itens`, role: 'admin', accountId: 'acc-other', body: { itens: [{ produto_id: produtoA.body.item.id, quantidade: 2 }] } });
        assertEqual(out.res.statusCode, 404);
      }
    }
  ];
}
