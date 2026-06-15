import { createApiApp } from '../../app.js';
import xlsx from 'xlsx';
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

function makeWorkbook(rows) {
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Pedidos');
  return xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export function getPedidosVendedorTests() {
  return [
    {
      name: 'PATCH /pedidos/:id/vendedor vincula vendedor do mesmo tenant, rejeita cross-tenant e preserva GET',
      run: async () => {
        const app = createApiApp();
        const accountA = 'acc-ped-vend-a';
        const accountB = 'acc-ped-vend-b';

        const clienteA = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: accountA, body: { nome: 'Cliente V A' } });
        const clienteB = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: accountB, body: { nome: 'Cliente V B' } });
        const produtoA = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: accountA, body: { nome: 'Produto V A', preco: 12 } });
        const produtoB = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId: accountB, body: { nome: 'Produto V B', preco: 12 } });
        const vendedorA = await call(app, { method: 'POST', url: '/vendedores', role: 'account_admin', accountId: accountA, body: { nome: 'Vendedor A' } });
        const vendedorB = await call(app, { method: 'POST', url: '/vendedores', role: 'account_admin', accountId: accountB, body: { nome: 'Vendedor B' } });

        const pedidoA = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: accountA, body: { cliente_id: clienteA.body.item.id, itens: [{ produto_id: produtoA.body.item.id, quantidade: 1, preco_unitario: 12 }] } });
        const importBase64 = makeWorkbook([{ Cliente: 'CLI-IMP', 'Número ERP': 'PED-IMP', Situação: 'Faturado Total', 'Valor Total': '12', Observacoes: 'importado' }]);
        const importCliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: accountA, body: { nome: 'CLI-IMP', codigo: 'CLI-IMP' } });
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: accountA, body: { arquivo: { fileName: 'Pedidos.xlsx', base64: importBase64 } } });
        assertEqual(preview.res.statusCode, 200);
        const executeImport = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: accountA, body: { importToken: preview.body.importToken } });
        assertEqual(executeImport.res.statusCode, 200);
        const pedidoSemOwner = executeImport.body.pedidos_criados[0];
        const pedidoB = await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId: accountB, body: { cliente_id: clienteB.body.item.id, itens: [{ produto_id: produtoB.body.item.id, quantidade: 1, preco_unitario: 12 }] } });

        const patchOk = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoA.body.pedido.id}/vendedor`, role: 'manager', accountId: accountA, body: { vendedor_id: vendedorA.body.item.id } });
        assertEqual(patchOk.res.statusCode, 200);
        assertEqual(patchOk.body.item.vendedor_id, vendedorA.body.item.id);

        const getAfter = await call(app, { method: 'GET', url: `/pedidos/${pedidoA.body.pedido.id}`, role: 'manager', accountId: accountA });
        assertEqual(getAfter.res.statusCode, 200);
        assertEqual(getAfter.body.pedido.vendedor_id, vendedorA.body.item.id);
        assertEqual(getAfter.body.pedido.vendedor.nome, 'Vendedor A');

        const crossTenantVendor = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoA.body.pedido.id}/vendedor`, role: 'manager', accountId: accountA, body: { vendedor_id: vendedorB.body.item.id } });
        assertEqual(crossTenantVendor.res.statusCode, 403);

        const crossTenantPedido = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoA.body.pedido.id}/vendedor`, role: 'manager', accountId: accountB, body: { vendedor_id: vendedorB.body.item.id } });
        assertEqual(crossTenantPedido.res.statusCode, 404);

        const patchImported = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoSemOwner.body.pedido.id}/vendedor`, role: 'manager', accountId: accountA, body: { vendedor_id: vendedorA.body.item.id } });
        assertEqual(patchImported.res.statusCode, 200);
        assertEqual(patchImported.body.item.vendedor_id, vendedorA.body.item.id);

        const getImported = await call(app, { method: 'GET', url: `/pedidos/${pedidoSemOwner.body.pedido.id}`, role: 'manager', accountId: accountA });
        assertEqual(getImported.res.statusCode, 200);
        assertEqual(getImported.body.pedido.vendedor_id, vendedorA.body.item.id);

        const patchNull = await call(app, { method: 'PATCH', url: `/pedidos/${pedidoSemOwner.id}/vendedor`, role: 'manager', accountId: accountA, body: { vendedor_id: null } });
        assertEqual(patchNull.res.statusCode, 400);
      }
    }
  ];
}
