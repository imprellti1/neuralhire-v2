import { defineModule } from '../../core/module-contract.js';

export const executiveDashboardModule = defineModule({ name: 'executive-dashboard', domain: 'customer-success', routes: ['GET /accounts/:accountId/executive-dashboard'] });
