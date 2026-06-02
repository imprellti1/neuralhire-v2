import assert from 'node:assert/strict';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createConversation, __resetMemoryWhatsappConversationsForTests } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';
import { getWhatsappConversationContext } from '../../modules/whatsapp-conversations/whatsapp-context.repository.js';
import { __resetMemoryCustomerMemoryForTests } from '../../modules/customer-memory/customer-memory.repository.js';
import { __resetMemoryCommercialAgentForTests, analyzeCommercialConversation, getCommercialActionForConversation } from '../../modules/commercial-agent/commercial-agent.repository.js';
import { analyzeCommercialAgentHandler } from '../../modules/commercial-agent/commercial-agent.controller.js';

function resetState() {
  __resetMemoryWhatsappConversationsForTests();
  __resetMemoryCustomerMemoryForTests();
  __resetMemoryCommercialAgentForTests();
}

export function getCommercialAgentTests() {
  return [
    {
      name: 'reactivation e persistencia',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Reativacao' }, { accountId: 'acc-a' });
        const conv = await createConversation({ phone: '11999999999', clienteId: cliente.id }, { accountId: 'acc-a' });
        await getWhatsappConversationContext(conv.id, { accountId: 'acc-a' });
        const result = await analyzeCommercialConversation(conv.id, { accountId: 'acc-a', memorySignals: { diasSemCompra: 147, activeCustomer: false, alertCount: 0 } });
        assert.equal(result.action_type, 'reactivation');
        assert.equal(result.confidence_score >= 70, true);
        const persisted = await getCommercialActionForConversation(conv.id, { accountId: 'acc-a' });
        assert.equal(persisted.id, result.id);
      }
    },
    {
      name: 'upsell cross_sell relationship risk_recovery scoring',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Acoes' }, { accountId: 'acc-b' });
        const conv = await createConversation({ phone: '11999999998', clienteId: cliente.id }, { accountId: 'acc-b' });
        const result = await analyzeCommercialConversation(conv.id, { accountId: 'acc-b' });
        assert.ok(['followup', 'relationship', 'reactivation', 'replenishment', 'upsell', 'cross_sell', 'risk_recovery'].includes(result.action_type));
        assert.equal(result.confidence_score >= 0 && result.confidence_score <= 100, true);
      }
    },
    {
      name: 'tenant isolation',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Tenant' }, { accountId: 'acc-c' });
        const conv = await createConversation({ phone: '11999999997', clienteId: cliente.id }, { accountId: 'acc-c' });
        await analyzeCommercialConversation(conv.id, { accountId: 'acc-c' });
        await assert.rejects(() => getCommercialActionForConversation(conv.id, { accountId: 'acc-d' }));
      }
    },
    {
      name: 'handler de analise comercial',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Handler' }, { accountId: 'acc-e' });
        const conv = await createConversation({ phone: '11999999996', clienteId: cliente.id }, { accountId: 'acc-e' });
        const result = await analyzeCommercialAgentHandler({ accountId: 'acc-e', body: { conversationId: conv.id } });
        assert.equal(result.ok, true);
        assert.equal(result.item.conversation_id, conv.id);
      }
    }
  ];
}
