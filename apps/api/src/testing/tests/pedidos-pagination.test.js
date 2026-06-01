import { assertEqual } from '../assert.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';
import {
  __resetMemoryPedidosForTests,
  createPedido,
  listPedidos
} from '../../modules/pedidos/pedidos.repository.js';

const accountId = 'acc-pedidos-pagination';

export function getPedidosPaginationTests() {
  return [
    {
      name: 'pedidos limit default e max',
      run: async () => {
        __resetMemoryPedidosForTests();
        const a = await listPedidos({}, { accountId: 'acc-p-empty' });
        const b = await listPedidos({ limit: 999 }, { accountId: 'acc-p-empty' });
        assertEqual(a.limit, 20);
        assertEqual(b.limit, 100);
      }
    },
    {
      name: 'pedidos totalPages e filtros cliente/status',
      run: async () => {
        __resetMemoryPedidosForTests();
        const c1 = await createCliente({ nome: 'Cliente 1' }, { accountId });
        const c2 = await createCliente({ nome: 'Cliente 2' }, { accountId });
        const p = await createProduto({ nome: 'Produto P' }, { accountId });

        await createPedido({ cliente_id: c1.id, status: 'rascunho', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        await createPedido({ cliente_id: c1.id, status: 'confirmado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });
        await createPedido({ cliente_id: c2.id, status: 'confirmado', itens: [{ produto_id: p.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });

        const paged = await listPedidos({ page: 1, limit: 2 }, { accountId });
        assertEqual(paged.totalPages, 2);

        const filtered = await listPedidos({ status: 'confirmado', cliente_id: c1.id }, { accountId });
        assertEqual(filtered.total, 1);
      }
    }
  ];
}
