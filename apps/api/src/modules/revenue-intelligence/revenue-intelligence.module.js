import { defineModule } from '../../core/module-contract.js';
export const revenueIntelligenceModule = defineModule({ name:'revenue-intelligence', domain:'customer-success', routes:['GET /accounts/:accountId/revenue-intelligence'] });
