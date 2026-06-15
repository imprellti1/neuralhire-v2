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

export function getPedidosUpdateTests() {
  return [
    {
      name: 'PATCH /pedidos/:id atualiza cliente, origem e observacoes',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-ped-edit';
        const clienteA = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente A' } });
        const clienteB = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente B' } });
        const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId, body: { nome: 'Produto 1', preco: 20 } });
        const created = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId, body: { cliente_id: clienteA.body.item.id, origem: 'manual', itens: [{ produto_id: produto.body.item.id, quantidade: 2 }] } });
        const pedidoId = created.body.pedido.id;
        const beforeStatus = created.body.pedido.status;
        const beforeTotal = created.body.pedido.total;

        const out = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoId}`, role: 'manager', accountId, body: { cliente_id: clienteB.body.item.id, origem: 'site', observacoes: 'Atualizado no 360', account_id: 'acc-evil', status: 'cancelado', itens: [] } });
        assertEqual(out.res.statusCode, 200);
        assertEqual(out.body.pedido.cliente_id, clienteB.body.item.id);
        assertEqual(out.body.pedido.origem, 'site');
        assertEqual(out.body.pedido.observacoes, 'Atualizado no 360');
        assertEqual(out.body.pedido.account_id, accountId);
        assertEqual(out.body.pedido.status, beforeStatus);
        assertEqual(out.body.pedido.total, beforeTotal);
        assertEqual(out.body.pedido.data_emissao, null);
        assertEqual(Array.isArray(out.body.itens), true);
        assertEqual(out.body.itens.length, 1);
      }
    },
    {
      name: 'GET /pedidos e GET /pedidos/:id retornam data_emissao',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-ped-edit-data';
        const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente Data' } });
        const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId, body: { nome: 'Produto Data', preco: 30 } });
        const created = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId, body: { cliente_id: cliente.body.item.id, data_emissao: '2026-03-15', origem: 'manual', itens: [{ produto_id: produto.body.item.id, quantidade: 1 }] } });
        const list = await call(app, { method: 'GET', url: '/pedidos', role: 'manager', accountId });
        assertEqual(list.body.items[0].data_emissao, '2026-03-15');
        const detail = await call(app, { method: 'GET', url: `/pedidos/${created.body.pedido.id}`, role: 'manager', accountId });
        assertEqual(detail.body.pedido.data_emissao, '2026-03-15');
      }
    },
    {
      name: 'PATCH /pedidos/:id atualiza updated_at e preserva historico',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-ped-edit-2';
        const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente H' } });
        const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId, body: { nome: 'Produto H', preco: 40 } });
        const created = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId, body: { cliente_id: cliente.body.item.id, origem: 'manual', itens: [{ produto_id: produto.body.item.id, quantidade: 1 }] } });
        const pedidoId = created.body.pedido.id;
        const beforeUpdated = created.body.pedido.updated_at || created.body.pedido.updatedAt || null;
        await call(app, { method: 'PATCH', url: `/pedidos/${pedidoId}/status`, role: 'manager', accountId, body: { status: 'aprovado' } });
        const historyBefore = await call(app, { method: 'GET', url: `/pedidos/${pedidoId}/history`, role: 'manager', accountId });

        const out = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoId}`, role: 'admin', accountId, body: { cliente_id: cliente.body.item.id, origem: 'whatsapp', observacoes: 'teste' } });
        const afterUpdated = out.body.pedido.updated_at || out.body.pedido.updatedAt || null;
        assertEqual(out.res.statusCode, 200);
        assertEqual(Boolean(afterUpdated), true);
        assertEqual(afterUpdated !== beforeUpdated, true);

        const historyAfter = await call(app, { method: 'GET', url: `/pedidos/${pedidoId}/history`, role: 'manager', accountId });
        assertEqual(historyAfter.body.items.length, historyBefore.body.items.length);
      }
    },
    {
      name: 'PATCH /pedidos/:id bloqueia tenant diferente e role sem permissao',
      run: async () => {
        const app = createApiApp();
        const accountId = 'acc-ped-edit-3';
        const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente X' } });
        const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId, body: { nome: 'Produto X', preco: 15 } });
        const created = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId, body: { cliente_id: cliente.body.item.id, itens: [{ produto_id: produto.body.item.id, quantidade: 1 }] } });

        const forbidden = await call(app, { method: 'PATCH', url: `/pedidos/${created.body.pedido.id}`, role: 'viewer', accountId, body: { cliente_id: cliente.body.item.id, origem: 'manual' } });
        assertEqual(forbidden.res.statusCode, 403);

        const otherTenant = await call(app, { method: 'PATCH', url: `/pedidos/${created.body.pedido.id}`, role: 'admin', accountId: 'acc-other', body: { cliente_id: cliente.body.item.id, origem: 'manual' } });
        assertEqual(otherTenant.res.statusCode, 404);
      }
    }
  ];
}
