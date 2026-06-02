import assert from 'node:assert/strict';
import { createCliente, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { createConversation, __resetMemoryWhatsappConversationsForTests } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';
import { __resetMemoryCustomerMemoryForTests } from '../../modules/customer-memory/customer-memory.repository.js';
import { analyzeCommercialConversation, __resetMemoryCommercialAgentForTests } from '../../modules/commercial-agent/commercial-agent.repository.js';
import { generateMessageDraftHandler } from '../../modules/message-drafts/message-drafts.controller.js';
import { getMessageDraftById, listMessageDraftsByConversation, __resetMemoryMessageDraftsForTests } from '../../modules/message-drafts/message-drafts.repository.js';
import { calculateConfidenceScore } from '../../modules/message-drafts/message-drafts.scoring.js';
import { generateDraft } from '../../modules/message-drafts/message-drafts.engine.js';

function resetState() {
  __resetMemoryClientesForTests();
  __resetMemoryWhatsappConversationsForTests();
  __resetMemoryCustomerMemoryForTests();
  __resetMemoryCommercialAgentForTests();
  __resetMemoryMessageDraftsForTests();
}

export function getMessageDraftsTests() {
  return [
    {
      name: 'reactivation',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Reativacao' }, { accountId: 'acc-a' });
        const conversation = await createConversation({ phone: '11999999999', clienteId: cliente.id }, { accountId: 'acc-a' });
        const draft = generateDraft({ customerMemory: { commercial: { diasSemCompra: 130 }, behavior: { frequenciaCompra: 'baixa' }, products: { recorrentes: [] }, alerts: [], opportunities: [] }, conversationStatus: 'open' });
        assert.equal(draft.draftType, 'reactivation');
        assert.match(draft.draftText, /Secretária do Igor/i);
        const saved = await generateMessageDraftHandler({ accountId: 'acc-a', body: { conversationId: conversation.id } });
        assert.equal(saved.draftType, 'reactivation');
      }
    },
    {
      name: 'replenishment',
      run: async () => {
        const draft = generateDraft({ action: { actionType: 'replenishment', confidence_score: 88, reason: 'Cliente já entrou no ciclo de recompra.' }, customerMemory: { commercial: { diasSemCompra: 20 }, behavior: { frequenciaCompra: 'alta' }, products: { recorrentes: [{ nome: 'Toalha' }] }, alerts: [], opportunities: [] }, conversationStatus: 'open' });
        assert.equal(draft.draftType, 'replenishment');
        assert.match(draft.draftText, /Toalha/i);
      }
    },
    {
      name: 'upsell',
      run: async () => {
        const draft = generateDraft({ action: { actionType: 'upsell', confidence_score: 76, reason: 'Conta cresceu e há espaço para ampliar carteira.' }, customerMemory: { commercial: { diasSemCompra: 5 }, behavior: { frequenciaCompra: 'media' }, products: { recorrentes: [] }, alerts: [], opportunities: [] }, conversationStatus: 'open' });
        assert.equal(draft.draftType, 'upsell');
      }
    },
    {
      name: 'cross_sell',
      run: async () => {
        const draft = generateDraft({ action: { actionType: 'cross_sell', confidence_score: 71, reason: 'Fabricantes não explorados.' }, customerMemory: { commercial: { diasSemCompra: 5 }, behavior: { frequenciaCompra: 'media' }, products: { recorrentes: [] }, manufacturers: { favoritos: ['Fab A'] }, alerts: [], opportunities: [] }, conversationStatus: 'open' });
        assert.equal(draft.draftType, 'cross_sell');
      }
    },
    {
      name: 'relationship',
      run: async () => {
        const draft = generateDraft({ action: { actionType: 'relationship', confidence_score: 63, reason: 'Cliente ativo e sem alertas.' }, customerMemory: { commercial: { diasSemCompra: 2 }, behavior: { frequenciaCompra: 'media' }, products: { recorrentes: [] }, alerts: [], opportunities: [] }, conversationStatus: 'open' });
        assert.equal(draft.draftType, 'relationship');
      }
    },
    {
      name: 'risk_recovery',
      run: async () => {
        const draft = generateDraft({ action: { actionType: 'risk_recovery', confidence_score: 90, reason: 'Risco alto de perda da conta.' }, customerMemory: { commercial: { diasSemCompra: 95 }, behavior: { frequenciaCompra: 'baixa' }, products: { recorrentes: [] }, alerts: [{ title: 'queda' }], opportunities: [] }, conversationStatus: 'open' });
        assert.equal(draft.draftType, 'risk_recovery');
      }
    },
    {
      name: 'confidence',
      run: async () => {
        const score = calculateConfidenceScore({ daysWithoutPurchase: 130, opportunityCount: 2, alertCount: 0, frequency: 'alta', hasRecurringProduct: true });
        assert.equal(score <= 100, true);
        assert.equal(score >= 0, true);
      }
    },
    {
      name: 'context',
      run: async () => {
        const draft = generateDraft({ customerMemory: { commercial: { diasSemCompra: 40 }, behavior: { frequenciaCompra: 'media' }, products: { recorrentes: [{ nome: 'Produto X' }] }, alerts: [{ title: 'Alerta' }], opportunities: [{ title: 'Oportunidade' }] }, conversationSummary: { lastMessage: 'oi' }, conversationStatus: 'closed' });
        assert.equal(draft.context.customerMemory.commercial.diasSemCompra, 40);
        assert.equal(Array.isArray(draft.context.opportunities), true);
      }
    },
    {
      name: 'tenant isolation',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Tenant' }, { accountId: 'acc-a' });
        const conversation = await createConversation({ phone: '11999999998', clienteId: cliente.id }, { accountId: 'acc-a' });
        const generated = await generateMessageDraftHandler({ accountId: 'acc-a', body: { conversationId: conversation.id } });
        await assert.rejects(() => getMessageDraftById(generated.draftId, { accountId: 'acc-b' }));
        const crossTenantDrafts = await listMessageDraftsByConversation(conversation.id, { accountId: 'acc-b' });
        assert.equal(crossTenantDrafts.length, 0);
      }
    },
    {
      name: 'draft persistido',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Persistido' }, { accountId: 'acc-p' });
        const conversation = await createConversation({ phone: '11999999997', clienteId: cliente.id }, { accountId: 'acc-p' });
        await analyzeCommercialConversation(conversation.id, { accountId: 'acc-p', memorySignals: { diasSemCompra: 147, activeCustomer: false, alertCount: 0 } });
        const generated = await generateMessageDraftHandler({ accountId: 'acc-p', body: { conversationId: conversation.id } });
        const stored = await getMessageDraftById(generated.draftId, { accountId: 'acc-p' });
        assert.equal(stored.conversation_id, conversation.id);
        assert.equal(stored.status, 'generated');
        assert.equal(stored.draft_text.length > 0, true);
        assert.equal(stored.action_type, 'reactivation');
        assert.equal(stored.action_id.length > 0, true);
        assert.equal(stored.context.action.action_type, 'reactivation');
      }
    }
  ];
}
