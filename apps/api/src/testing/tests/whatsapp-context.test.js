import assert from 'node:assert/strict';
import { createCliente, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { createPedido, __resetMemoryPedidosForTests } from '../../modules/pedidos/pedidos.repository.js';
import { createProduto, __resetMemoryProdutosForTests } from '../../modules/produtos/produtos.repository.js';
import { createConversation, __resetMemoryWhatsappConversationsForTests } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';
import { getWhatsappConversationContext } from '../../modules/whatsapp-conversations/whatsapp-context.repository.js';
import { getCustomerMemory, __resetMemoryCustomerMemoryForTests } from '../../modules/customer-memory/customer-memory.repository.js';

function resetState() {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryWhatsappConversationsForTests();
  __resetMemoryCustomerMemoryForTests();
}

export function getWhatsappContextTests() {
  return [
    {
      name: 'conversa com memoria retorna contexto completo',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Contexto', cidade: 'Sao Paulo', uf: 'SP' }, { accountId: 'acc-a' });
        const produto = await createProduto({ nome: 'Produto Contexto', preco: 120 }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 2, preco_unitario: 120 }] }, { accountId: 'acc-a' });
        await getCustomerMemory(cliente.id, { accountId: 'acc-a' });
        const conversation = await createConversation({ phone: '11999999999', clienteId: cliente.id, contactName: 'Cliente Contexto' }, { accountId: 'acc-a' });
        const result = await getWhatsappConversationContext(conversation.id, { accountId: 'acc-a' });
        assert.equal(result.customer.clienteId, cliente.id);
        assert.equal(result.memory.commercial.totalPedidos, 1);
      }
    },
    {
      name: 'conversa sem memoria faz rebuild automatico',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Rebuild' }, { accountId: 'acc-b' });
        const produto = await createProduto({ nome: 'Produto Rebuild', preco: 100 }, { accountId: 'acc-b' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 100 }] }, { accountId: 'acc-b' });
        const conversation = await createConversation({ phone: '11999999998', clienteId: cliente.id }, { accountId: 'acc-b' });
        const result = await getWhatsappConversationContext(conversation.id, { accountId: 'acc-b' });
        assert.equal(result.memory.commercial.totalPedidos, 1);
      }
    },
    {
      name: 'conversa sem cliente retorna contexto vazio',
      run: async () => {
        resetState();
        const conversation = await createConversation({ phone: '11999999997' }, { accountId: 'acc-c' });
        const result = await getWhatsappConversationContext(conversation.id, { accountId: 'acc-c' });
        assert.equal(result.customer, null);
        assert.equal(result.memory.summary, '');
      }
    },
    {
      name: 'tenant isolation bloqueia leitura cross tenant',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Tenant Context' }, { accountId: 'acc-t1' });
        const conversation = await createConversation({ phone: '11999999996', clienteId: cliente.id }, { accountId: 'acc-t1' });
        await assert.rejects(() => getWhatsappConversationContext(conversation.id, { accountId: 'acc-t2' }));
      }
    },
    {
      name: 'accountId obrigatorio',
      run: async () => {
        resetState();
        await assert.rejects(() => getWhatsappConversationContext('any'));
      }
    }
  ];
}
