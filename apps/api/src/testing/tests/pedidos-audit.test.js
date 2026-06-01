import { assert, assertEqual } from '../assert.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryPedidosForTests, createPedido, getPedidoStatusHistory, updatePedidoStatus } from '../../modules/pedidos/pedidos.repository.js';

const accountId = 'acc-audit';

export function getPedidosAuditTests() {
  return [
    { name: 'historico e auditoria de status', run: async () => { __resetMemoryPedidosForTests(); const c = await createCliente({ nome: 'C' }, { accountId }); const p = await createProduto({ nome: 'P' }, { accountId }); const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId }); const result = await updatePedidoStatus(created.pedido.id, { status: 'aprovado', motivo: 'pedido liberado comercialmente' }, { accountId, context: { requestId: 'req-audit-1', auth: { userId: 'u-1', role: 'manager', accountId } } }); const history = await getPedidoStatusHistory(created.pedido.id, { accountId }); assertEqual(history.length, 1); assertEqual(history[0].status_anterior, 'rascunho'); assertEqual(history[0].status_novo, 'aprovado'); assert(!!result.audit.actor, 'actor ausente'); assertEqual(result.audit.actor.userId, 'u-1'); assertEqual(result.audit.requestId, 'req-audit-1'); } }
  ];
}

