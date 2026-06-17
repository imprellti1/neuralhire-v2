import { defineModule } from '../../core/module-contract.js';

export const jobsModule = defineModule({
  name: 'jobs',
  domain: 'system-jobs',
  routes: ['GET /jobs', 'POST /jobs/radar-comercial/run']
});
