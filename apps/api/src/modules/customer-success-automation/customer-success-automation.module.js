import { defineModule } from '../../core/module-contract.js';
export const customerSuccessAutomationModule = defineModule({ name: 'customer-success-automation', domain: 'customer-success', routes: ['GET /accounts/:accountId/customer-success-automation'] });
