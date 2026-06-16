import { defineModule } from '../../core/module-contract.js';

export const gruposComerciaisModule = defineModule({
  name: 'grupos-comerciais',
  domain: 'grupos-comerciais',
  routes: ['GET /grupos-comerciais', 'POST /grupos-comerciais', 'GET /grupos-comerciais/:id', 'PATCH /grupos-comerciais/:id', 'DELETE /grupos-comerciais/:id', 'GET /grupos-comerciais/:id/clientes', 'POST /grupos-comerciais/:id/clientes', 'DELETE /grupos-comerciais/:id/clientes/:clienteId']
});
