import { defineModule } from '../../core/module-contract.js';

export const vendedoresModule = defineModule({
  name: 'vendedores',
  domain: 'vendedores',
  routes: [
    'GET /vendedores',
    'GET /vendedores/:id',
    'POST /vendedores',
    'PATCH /vendedores/:id',
    'PATCH /vendedores/:id/status',
    'GET /vendedores/:id/fabricantes',
    'PUT /vendedores/:id/fabricantes'
  ]
});
