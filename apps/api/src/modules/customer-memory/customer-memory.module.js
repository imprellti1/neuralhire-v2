import { defineModule } from '../../core/module-contract.js';

export const customerMemoryModule = defineModule({
  name: 'customer-memory',
  domain: 'customer-success',
  routes: [
    'GET /accounts/:accountId/customer-memory/:clienteId',
    'GET /accounts/:accountId/customer-memory/:clienteId/summary',
    'POST /accounts/:accountId/customer-memory/:clienteId/rebuild'
  ]
});
