import { defineModule } from '../../core/module-contract.js';
export const interestLeadsModule = defineModule({ name: 'interest-leads', domain: 'pre-lancamento', routes: ['POST /interest-leads', 'GET /interest-leads', 'PATCH /interest-leads/:id/status', 'GET /interest-leads/export.csv'] });
