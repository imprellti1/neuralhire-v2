import { defineModule } from '../../core/module-contract.js';

export const messageApprovalsModule = defineModule({
  name: 'message-approvals',
  domain: 'whatsapp',
  routes: [
    'GET /message-approvals/pending',
    'GET /message-approvals',
    'GET /message-approvals/:approvalId',
    'POST /message-approvals/:draftId/approve',
    'POST /message-approvals/:draftId/reject'
  ]
});
