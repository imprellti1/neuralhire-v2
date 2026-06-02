import { defineModule } from '../../core/module-contract.js';
export const implementationTrackerModule = defineModule({ name: 'implementation-tracker', domain: 'implementation', routes: ['GET /accounts/:accountId/implementation-status'] });
