import assert from 'node:assert/strict';
import { __resetMemoryMessageDraftsForTests, saveMessageDraft } from '../../modules/message-drafts/message-drafts.repository.js';
import { __resetMemoryWhatsappConversationsForTests, createConversation } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';
import { __resetMemoryMessageApprovalsForTests, approveDraft } from '../../modules/message-approvals/message-approvals.repository.js';
import { __resetMemoryWhatsappDeliveryForTests, sendApprovedDraft } from '../../modules/whatsapp-delivery/whatsapp-delivery.repository.js';

function resetState() {
  __resetMemoryMessageDraftsForTests();
  __resetMemoryWhatsappConversationsForTests();
  __resetMemoryMessageApprovalsForTests();
  __resetMemoryWhatsappDeliveryForTests();
}

export function getWhatsappDeliveryTests() {
  return [
    { name: 'envia draft aprovado', run: async () => { resetState(); const previous = { url: process.env.EVOLUTION_API_URL, key: process.env.EVOLUTION_API_KEY, instance: process.env.EVOLUTION_INSTANCE }; process.env.EVOLUTION_API_URL = 'http://localhost'; process.env.EVOLUTION_API_KEY = 'test-key'; process.env.EVOLUTION_INSTANCE = 'test-instance'; try { const conversation = await createConversation({ phone: '5511999999999', contactName: 'Ana' }, { accountId: 'acc-1' }); const draft = await saveMessageDraft({ conversationId: conversation.id, draftText: 'Ola Ana' }, { accountId: 'acc-1' }); await approveDraft(draft.id, { accountId: 'acc-1' }); const result = await sendApprovedDraft(draft.id, { accountId: 'acc-1' }); assert.equal(result.ok, true); assert.equal(result.status, 'sent'); } finally { process.env.EVOLUTION_API_URL = previous.url; process.env.EVOLUTION_API_KEY = previous.key; process.env.EVOLUTION_INSTANCE = previous.instance; } } },
    { name: 'bloqueia draft nao aprovado', run: async () => { resetState(); const conversation = await createConversation({ phone: '5511999999999', contactName: 'Ana' }, { accountId: 'acc-1' }); const draft = await saveMessageDraft({ conversationId: conversation.id, draftText: 'Ola Ana' }, { accountId: 'acc-1' }); const result = await sendApprovedDraft(draft.id, { accountId: 'acc-1' }); assert.equal(result.ok, false); assert.equal(result.code, 'DRAFT_NOT_APPROVED'); } }
  ];
}
