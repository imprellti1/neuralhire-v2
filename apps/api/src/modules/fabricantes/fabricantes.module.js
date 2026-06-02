import { defineModule } from '../../core/module-contract.js';

export const fabricantesModule = defineModule({
  name: 'fabricantes',
  domain: 'fabricantes',
  dependencies: [],
  routes: [
    'GET /fabricantes',
    'GET /fabricantes/:id',
    'POST /fabricantes',
    'PATCH /fabricantes/:id',
    'GET /fabricantes/:id/condicoes-pagamento',
    'POST /fabricantes/:id/condicoes-pagamento',
    'PATCH /fabricantes/:id/condicoes-pagamento/:condicaoId'
  ]
});
