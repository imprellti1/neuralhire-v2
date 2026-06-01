import { defineModule } from '../../core/module-contract.js';

export const clientesModule = defineModule({
  name: 'clientes',
  domain: 'clientes-crm',
  routes: ['GET /clientes', 'GET /clientes/:id', 'POST /clientes']
});
