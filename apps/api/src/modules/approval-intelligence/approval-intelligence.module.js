import { defineModule } from '../../core/module-contract.js';

export const approvalIntelligenceModule = defineModule({
  name: 'approval-intelligence',
  domain: 'whatsapp',
  routes: [
    'GET /approval-intelligence/dashboard',
    'GET /approval-intelligence/trends',
    'GET /approval-intelligence/reasons',
    'GET /approval-intelligence/actions'
  ]
});

