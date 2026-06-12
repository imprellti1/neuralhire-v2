import { defineModule } from '../../core/module-contract.js';

export const aiDirectorModule = defineModule({
  name: 'ai-director',
  domain: 'ai-director',
  routes: ['GET /ai-director/dashboard']
});
