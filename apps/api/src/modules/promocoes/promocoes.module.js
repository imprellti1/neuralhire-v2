import { defineModule } from '../../core/module-contract.js';

export const promocoesModule = defineModule({
  name: 'promocoes',
  domain: 'promocoes',
  routes: ['GET /promocoes', 'GET /promocoes/:id', 'POST /promocoes', 'PATCH /promocoes/:id', 'DELETE /promocoes/:id', 'GET /produtos/:id/promocoes']
});

