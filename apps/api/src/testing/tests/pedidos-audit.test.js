import { assert, assertEqual } from '../assert.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';
import { createVendedor } from '../../modules/vendedores/vendedores.repository.js';
import {
  __resetMemoryPedidosForTests,
  createPedido,
  getPedidoStatusHistory,
  listPedidosAuditoria,
  updatePedidoComissao,
  updatePedidoFaturamento,
  updatePedidoStatus,
  updatePedidoVendedor
} from '../../modules/pedidos/pedidos.repository.js';

const accountId = 'acc-audit';

export function getPedidosAuditTests() {
  return [
    {
      name: 'auditoria marca sem_comissao sem_itens sem_vendedor e nao_faturado_total',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'C', razao_social: 'Cliente C LTDA' }, { accountId });
        const p = await createProduto({ nome: 'P' }, { accountId });
        const pedido = await createPedido({ cliente_id: c.id, status: 'confirmado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const snapshot = { pedidos: [{ ...pedido.pedido, comissao_principal_percentual: 0, comissao_preposto_percentual: 0, status: 'confirmado' }], pedidoItens: [], pedidoStatusHistory: [] };
        const { __loadMemoryPedidos } = await import('../../modules/pedidos/pedidos.repository.js');
        __loadMemoryPedidos(snapshot);
        const audit = await listPedidosAuditoria({}, { accountId });
        assertEqual(audit.items[0].issues.includes('sem_comissao'), true);
        assertEqual(audit.items[0].issues.includes('sem_itens'), true);
        assertEqual(audit.items[0].issues.includes('sem_vendedor'), true);
        assertEqual(audit.items[0].issues.includes('nao_faturado_total'), true);
        assertEqual(audit.items[0].cliente_nome, 'Cliente C LTDA');
        assertEqual(audit.items[0].vendedor_nome, null);
      }
    },
    {
      name: 'auditoria exclui pedidos cancelados',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'C', razao_social: 'Cliente C LTDA' }, { accountId });
        const p = await createProduto({ nome: 'P' }, { accountId });
        const active = await createPedido({ cliente_id: c.id, status: 'confirmado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const canceled = await createPedido({ cliente_id: c.id, status: 'cancelado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const snapshot = { pedidos: [{ ...active.pedido }, { ...canceled.pedido }], pedidoItens: [{ ...active.itens[0] }, { ...canceled.itens[0] }], pedidoStatusHistory: [] };
        const { __loadMemoryPedidos } = await import('../../modules/pedidos/pedidos.repository.js');
        __loadMemoryPedidos(snapshot);
        const audit = await listPedidosAuditoria({}, { accountId });
        assertEqual(audit.items.some((item) => item.id === canceled.pedido.id), false);
        assertEqual(audit.items.some((item) => item.id === active.pedido.id), true);
      }
    },
    {
      name: 'patch comissao atualiza percentuais',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'C' }, { accountId });
        const p = await createProduto({ nome: 'P' }, { accountId });
        const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const result = await updatePedidoComissao(created.pedido.id, { comissao_principal_percentual: 12.5, comissao_preposto_percentual: 3 }, { accountId });
        assertEqual(result.item.comissao_principal_percentual, 12.5);
        assertEqual(result.item.comissao_preposto_percentual, 3);
      }
    },
    {
      name: 'patch faturamento grava data e status total',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'C' }, { accountId });
        const p = await createProduto({ nome: 'P' }, { accountId });
        const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const result = await updatePedidoFaturamento(created.pedido.id, { data_faturamento: '2026-06-15' }, { accountId });
        assertEqual(result.item.data_faturamento, '2026-06-15');
        assertEqual(result.item.status, 'faturado_total');
      }
    },
    {
      name: 'historico e auditoria de status',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'C' }, { accountId });
        const p = await createProduto({ nome: 'P' }, { accountId });
        const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const result = await updatePedidoStatus(created.pedido.id, { status: 'aprovado', motivo: 'pedido liberado comercialmente' }, { accountId, context: { requestId: 'req-audit-1', auth: { userId: 'u-1', role: 'manager', accountId } } });
        const history = await getPedidoStatusHistory(created.pedido.id, { accountId });
        assertEqual(history.length, 1);
        assertEqual(history[0].status_anterior, 'rascunho');
        assertEqual(history[0].status_novo, 'aprovado');
        assert(!!result.audit.actor, 'actor ausente');
        assertEqual(result.audit.actor.userId, 'u-1');
        assertEqual(result.audit.requestId, 'req-audit-1');
      }
    },
    {
      name: 'historico funciona sem owner_user_id no pedido importado',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'C Importado' }, { accountId });
        const p = await createProduto({ nome: 'P Importado' }, { accountId });
        const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const { __dumpMemoryPedidos, __loadMemoryPedidos } = await import('../../modules/pedidos/pedidos.repository.js');
        const snapshot = __dumpMemoryPedidos();
        snapshot.pedidos = snapshot.pedidos.map((item) => item.id === created.pedido.id ? (() => { const next = { ...item }; delete next.owner_user_id; return next; })() : item);
        __loadMemoryPedidos(snapshot);
        const history = await getPedidoStatusHistory(created.pedido.id, { accountId });
        assertEqual(Array.isArray(history), true);
        assertEqual(history.length, 0);
      }
    },
    {
      name: 'patch vendedor vincula vendedor do mesmo tenant e rejeita outro tenant',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'C Vendedor' }, { accountId });
        const p = await createProduto({ nome: 'P Vendedor' }, { accountId });
        const vendedor = await createVendedor({ nome: 'Vendedor Auditoria' }, { accountId });
        const outroVendedor = await createVendedor({ nome: 'Vendedor Outra Conta' }, { accountId: 'acc-outro' });
        const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const result = await updatePedidoVendedor(created.pedido.id, { vendedor_id: vendedor.id }, { accountId });
        assertEqual(result.item.vendedor_id, vendedor.id);
        let blocked = false;
        try {
          await updatePedidoVendedor(created.pedido.id, { vendedor_id: outroVendedor.id }, { accountId });
        } catch {
          blocked = true;
        }
        assertEqual(blocked, true);
      }
    }
  ];
}
