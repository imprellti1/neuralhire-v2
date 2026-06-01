import { defineModule } from '../../core/module-contract.js';

export const analyticsModule = defineModule({
  name: 'analytics',
  domain: 'analytics-comercial',
  routes: [
    'GET /analytics/summary',
    'GET /analytics/products',
    'GET /analytics/customers',
    'GET /analytics/timeline'
  ]
});
