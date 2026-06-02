import { defineModule } from '../../core/module-contract.js';

export const commercialAgentModule = defineModule({
  name: 'commercial-agent',
  domain: 'whatsapp',
  routes: [
    'POST /commercial-agent/analyze',
    'GET /commercial-agent/conversation/:conversationId'
  ]
});
