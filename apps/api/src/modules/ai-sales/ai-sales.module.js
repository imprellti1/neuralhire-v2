import { defineModule } from '../../core/module-contract.js';

export const aiSalesModule = defineModule({
  name: 'ai-sales',
  domain: 'ai-sales',
  routes: ['GET /ai-sales/overview', 'GET /ai-sales/portfolio', 'GET /ai-sales/alerts', 'GET /ai-sales/tasks', 'GET /ai-sales/opportunities', 'GET /ai-sales/performance']
});

