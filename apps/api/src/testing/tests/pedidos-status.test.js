import { assertEqual } from '../assert.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';
import {
  __resetMemoryPedidosForTests,
  createPedido,
  listPedidos
} from '../../modules/pedidos/pedidos.repository.js';

const accountId = 'acc-pedidos-status';

export function getPedidosStatusTests() {
  return [
    {
      name: 'status default rascunho e origem default manual',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'Cliente S' }, { accountId });
        const p = await createProduto({ nome: 'Produto S' }, { accountId });
        const created = await createPedido({ cliente_id: c.id, itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        assertEqual(created.pedido.status, 'rascunho');
        assertEqual(created.pedido.origem, 'manual');
      }
    },
    {
      name: 'filtro por status',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c = await createCliente({ nome: 'Cliente S' }, { accountId });
        const p = await createProduto({ nome: 'Produto S' }, { accountId });
        await createPedido({ cliente_id: c.id, status: 'confirmado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        await createPedido({ cliente_id: c.id, status: 'rascunho', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        const filtered = await listPedidos({ status: 'confirmado' }, { accountId });
        assertEqual(filtered.total, 1);
      }
    }
  ];
}
