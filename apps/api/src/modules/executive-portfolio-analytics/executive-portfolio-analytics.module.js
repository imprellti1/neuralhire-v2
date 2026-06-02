import { defineModule } from '../../core/module-contract.js';

export const executivePortfolioAnalyticsModule = defineModule({
  name: 'executive-portfolio-analytics',
  domain: 'customer-success',
  routes: ['GET /executive-portfolio-analytics']
});
