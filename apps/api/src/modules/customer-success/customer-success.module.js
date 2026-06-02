import { defineModule } from '../../core/module-contract.js';
export const customerSuccessModule = defineModule({ name: 'customer-success', domain: 'customer-success', routes: ['GET /accounts/:accountId/customer-success'] });
