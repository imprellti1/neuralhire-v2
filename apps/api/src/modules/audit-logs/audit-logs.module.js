import { defineModule } from '../../core/module-contract.js';

export const auditLogsModule = defineModule({
  name: 'audit-logs',
  domain: 'system-audit',
  routes: ['GET /audit-logs', 'GET /audit-logs/:id']
});
