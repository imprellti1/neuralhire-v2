import { defineModule } from '../../core/module-contract.js';
export const billingModule = defineModule({ name: 'billing', domain: 'billing', routes: ['GET /billing/plans', 'POST /accounts/:accountId/subscription/prepare', 'POST /accounts/:accountId/subscription/activate', 'POST /accounts/:accountId/subscription/cancel', 'GET /accounts/:accountId/subscription', 'POST /webhooks/asaas'] });
