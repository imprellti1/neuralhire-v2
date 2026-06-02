import assert from 'node:assert/strict';
import { createConversation, __resetMemoryWhatsappConversationsForTests } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';
import { saveMessageDraft, __resetMemoryMessageDraftsForTests } from '../../modules/message-drafts/message-drafts.repository.js';
import { createApproval, __resetMemoryMessageApprovalsForTests } from '../../modules/message-approvals/message-approvals.repository.js';
import { getWhatsappConversationDraftStateHandler } from '../../modules/whatsapp-conversations/whatsapp-conversations.controller.js';

export function getWhatsappDraftStateTests() {
  return [
    { name: 'consolida draft approval e delivery state', run: async () => {
      __resetMemoryWhatsappConversationsForTests();
      __resetMemoryMessageDraftsForTests();
      __resetMemoryMessageApprovalsForTests();
      const conv = await createConversation({ phone: '11999999999', clienteId: 'cli-1' }, { accountId: 'acc-a' });
      const draft = await saveMessageDraft({ conversationId: conv.id, status: 'generated', draftText: 'oi' }, { accountId: 'acc-a' });
      await createApproval({ draftId: draft.id, status: 'pending' }, { accountId: 'acc-a' });
      const result = await getWhatsappConversationDraftStateHandler({ accountId: 'acc-a', params: { conversationId: conv.id } });
      assert.equal(result.draft.id, draft.id);
      assert.equal(result.approval.status, 'pending');
      assert.equal(result.delivery.status, null);
    } }
  ];
}
