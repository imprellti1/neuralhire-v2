import { defineModule } from '../../core/module-contract.js';

export const portfolioDashboardModule = defineModule({ name: 'portfolio-dashboard', domain: 'customer-success', routes: ['GET /portfolio-dashboard'] });
