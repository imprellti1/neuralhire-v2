import { assert, assertEqual } from '../assert.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryPedidosForTests, createPedido, updatePedidoStatus } from '../../modules/pedidos/pedidos.repository.js';

const accountId = 'acc-status-update';

export function getPedidosStatusUpdateTests() {
  return [
    { name: 'rascunho -> aprovado', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); const updated = await updatePedidoStatus(created.pedido.id, { status: 'aprovado' }, { accountId, context: { requestId: 'r1', auth: { role: 'manager', accountId } } }); assertEqual(updated.item.status, 'aprovado'); } },
    { name: 'aprovado -> confirmado', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, status: 'aprovado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); const updated = await updatePedidoStatus(created.pedido.id, { status: 'confirmado' }, { accountId, context: { requestId: 'r2', auth: { role: 'manager', accountId } } }); assertEqual(updated.item.status, 'confirmado'); } },
    { name: 'aprovado -> faturado', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, status: 'aprovado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); const updated = await updatePedidoStatus(created.pedido.id, { status: 'faturado' }, { accountId, context: { requestId: 'r3', auth: { role: 'manager', accountId } } }); assertEqual(updated.item.status, 'faturado'); } },
    { name: 'cancelamento valido', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, status: 'confirmado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); const updated = await updatePedidoStatus(created.pedido.id, { status: 'cancelado', motivo: 'cliente desistiu' }, { accountId, context: { requestId: 'r4', auth: { role: 'manager', accountId } } }); assertEqual(updated.item.status, 'cancelado'); assert(!!updated.audit, 'audit ausente'); } }
  ];
}

