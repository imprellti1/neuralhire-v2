import { defineModule } from '../../core/module-contract.js';

export const aiDirectorModule = defineModule({
  name: 'ai-director',
  domain: 'ai-director',
  routes: ['GET /ai-director/dashboard', 'GET /ai-director/memories', 'POST /ai-director/memories', 'GET /ai-director/executive-memories', 'GET /ai-director/managers', 'POST /ai-director/managers/:id/consult', 'POST /ai-director/delegate', 'POST /ai-director/ask', 'GET /ai-director/observations', 'GET /ai-director/observations/:id', 'POST /ai-director/observations', 'PATCH /ai-director/observations/:id']
});
