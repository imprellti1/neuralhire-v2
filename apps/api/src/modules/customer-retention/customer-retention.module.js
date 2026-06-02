import { defineModule } from '../../core/module-contract.js';

export const customerRetentionModule = defineModule({
  name: 'customer-retention',
  domain: 'customer-success',
  routes: ['GET /accounts/:accountId/customer-retention']
});
