import { assertEqual } from '../assert.js';
import { canTransitionPedidoStatus, isValidPedidoStatus } from '../../modules/pedidos/pedidos.schemas.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryPedidosForTests, createPedido, updatePedidoStatus } from '../../modules/pedidos/pedidos.repository.js';

const accountId = 'acc-status-rules';

async function expectError(fn, code) {
  let ok = false;
  try { await fn(); } catch (error) { ok = error?.code === code; }
  if (!ok) throw new Error(`Era esperado ${code}`);
}

export function getPedidosStatusRulesTests() {
  return [
    { name: 'helper status invalido', run: async () => { assertEqual(isValidPedidoStatus('xpto'), false); assertEqual(canTransitionPedidoStatus('faturado', 'cancelado'), false); } },
    { name: 'faturado -> cancelado bloqueado', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, status: 'aprovado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); await updatePedidoStatus(created.pedido.id, { status: 'faturado' }, { accountId, context: { auth: { role: 'manager', accountId } } }); await expectError(() => updatePedidoStatus(created.pedido.id, { status: 'cancelado' }, { accountId, context: { auth: { role: 'manager', accountId } } }), 'INVALID_STATUS_TRANSITION'); } },
    { name: 'cancelado -> rascunho permitido', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, status: 'aprovado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); await updatePedidoStatus(created.pedido.id, { status: 'cancelado' }, { accountId, context: { auth: { role: 'manager', accountId } } }); const reopened = await updatePedidoStatus(created.pedido.id, { status: 'rascunho' }, { accountId, context: { auth: { role: 'manager', accountId } } }); assertEqual(reopened.item.status, 'rascunho'); } },
    { name: 'status invalido gera erro', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); await expectError(() => updatePedidoStatus(created.pedido.id, { status: 'nao-existe' }, { accountId, context: { auth: { role: 'manager', accountId } } }), 'VALIDATION_ERROR'); } }
  ];
}
