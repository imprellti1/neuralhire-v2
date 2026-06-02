import { defineModule } from '../../core/module-contract.js';

export const whatsappConversationsModule = defineModule({
  name: 'whatsapp-conversations',
  domain: 'whatsapp',
  routes: [
    'GET /whatsapp/conversations',
    'GET /whatsapp/conversations/:conversationId',
    'GET /whatsapp/conversations/:conversationId/context',
    'POST /whatsapp/conversations',
    'POST /whatsapp/conversations/:conversationId/messages',
    'PATCH /whatsapp/conversations/:conversationId/status',
    'POST /whatsapp/conversations/:conversationId/events'
  ]
});
