import { defineModule } from '../../core/module-contract.js';

export const aiDirectorModule = defineModule({
  name: 'ai-director',
  domain: 'ai-director',
  routes: [
    'GET /ai-director/overview',
    'GET /ai-director/agents',
    'GET /ai-director/events',
    'POST /ai-director/events',
    'PATCH /ai-director/events/:id/read',
    'PATCH /ai-director/events/:id/archive',
    'GET /ai-director/recommendations'
  ]
});
