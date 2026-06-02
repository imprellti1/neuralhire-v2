import assert from 'node:assert/strict';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import { buildCustomerMemory } from '../../modules/customer-memory/customer-memory.builder.js';
import { getCustomerMemory, getCustomerMemorySummary, rebuildCustomerMemory } from '../../modules/customer-memory/customer-memory.repository.js';
import { scoreCustomerMemory } from '../../modules/customer-memory/customer-memory.scoring.js';

function resetState() {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
}

export function getCustomerMemoryTests() {
  return [
    {
      name: 'scoreCustomerMemory classifica risco frequencia e potencial',
      run: async () => {
        const scored = scoreCustomerMemory({ commercial: { diasSemCompra: 180, totalPedidos: 12, totalComprado: 90000, ticketMedio: 8500 } });
        assert.equal(scored.risk, 'alto');
        assert.equal(scored.frequenciaCompra, 'alta');
        assert.equal(scored.potencial, 'alto');
      }
    },
    {
      name: 'buildCustomerMemory cria memoria com isolamento de tenant',
      run: async () => {
        resetState();
        const clienteA = await createCliente({ nome: 'Cliente Memoria', owner_user_id: 'sales-a' }, { accountId: 'acc-a' });
        const clienteB = await createCliente({ nome: 'Cliente Outro' }, { accountId: 'acc-b' });
        const produtoA = await createProduto({ nome: 'Toalha A', preco: 100 }, { accountId: 'acc-a' });
        const produtoB = await createProduto({ nome: 'Toalha B', preco: 200 }, { accountId: 'acc-b' });
        await createPedido({ cliente_id: clienteA.id, itens: [{ produto_id: produtoA.id, quantidade: 2, preco_unitario: 100 }] }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: clienteA.id, itens: [{ produto_id: produtoA.id, quantidade: 1, preco_unitario: 100 }] }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: clienteB.id, itens: [{ produto_id: produtoB.id, quantidade: 1, preco_unitario: 200 }] }, { accountId: 'acc-b' });

        const memory = await buildCustomerMemory(clienteA.id, { accountId: 'acc-a' });
        assert.equal(memory.commercial.totalPedidos, 2);
        assert.equal(memory.commercial.totalComprado, 300);
        assert.equal(Array.isArray(memory.products.recorrentes), true);
        assert.equal(memory.products.recorrentes.length >= 0, true);
        assert.equal('account_id' in memory, false);
        assert.equal('tenant_id' in memory, false);
        assert.equal('owner_user_id' in memory, false);
      }
    },
    {
      name: 'cliente sem pedidos retorna memoria vazia sem falhar',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Sem pedidos' }, { accountId: 'acc-empty' });
        const memory = await buildCustomerMemory(cliente.id, { accountId: 'acc-empty' });
        assert.equal(memory.commercial.totalPedidos, 0);
        assert.equal(memory.commercial.totalComprado, 0);
        assert.equal(memory.products.recorrentes.length, 0);
        assert.equal(memory.opportunities.length >= 1, true);
      }
    },
    {
      name: 'getCustomerMemory e rebuildCustomerMemory mantem resposta consistente',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Consistente' }, { accountId: 'acc-consistent' });
        const produto = await createProduto({ nome: 'Produto Consistente', preco: 150 }, { accountId: 'acc-consistent' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 2, preco_unitario: 150 }] }, { accountId: 'acc-consistent' });

        const memory = await getCustomerMemory(cliente.id, { accountId: 'acc-consistent' });
        const summary = await getCustomerMemorySummary(cliente.id, { accountId: 'acc-consistent' });
        const rebuilt = await rebuildCustomerMemory(cliente.id, { accountId: 'acc-consistent' });
        assert.equal(memory.clienteId, cliente.id);
        assert.equal(summary.clienteId, cliente.id);
        assert.equal(rebuilt.clienteId, cliente.id);
        assert.equal(summary.summary, memory.summary);
        assert.equal(Array.isArray(summary.opportunities), true);
      }
    },
    {
      name: 'tenant isolation bloqueia leitura cross tenant',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Tenant' }, { accountId: 'acc-tenant-a' });
        await assert.rejects(() => getCustomerMemory(cliente.id, { accountId: 'acc-tenant-b' }));
      }
    }
  ];
}
