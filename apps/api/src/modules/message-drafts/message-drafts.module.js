import { defineModule } from '../../core/module-contract.js';

export const messageDraftsModule = defineModule({
  name: 'message-drafts',
  domain: 'whatsapp',
  routes: [
    'POST /message-drafts/generate',
    'GET /message-drafts/:draftId',
    'GET /message-drafts/conversation/:conversationId'
  ]
});
