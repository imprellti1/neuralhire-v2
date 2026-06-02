import { defineModule } from '../../core/module-contract.js';

export const legacyImportModule = defineModule({
  name: 'legacy-import',
  domain: 'legacy-import',
  dependencies: [],
  routes: ['GET /legacy-import/status', 'GET /legacy-import/batches', 'GET /legacy-import/batches/:batchId', 'GET /legacy-import/batches/:batchId/records', 'GET /legacy-import/batches/:batchId/issues', 'GET /legacy-import/batches/:batchId/audit', 'GET /legacy-import/batches/:batchId/report', 'POST /legacy-import/batches/:batchId/approve', 'POST /legacy-import/batches/:batchId/reject', 'POST /legacy-import/batches/:batchId/promote', 'POST /legacy-import/preview', 'POST /legacy-import/validate', 'POST /legacy-import/execute']
});
