import { defineModule } from '../../core/module-contract.js';

export const produtosModule = defineModule({
  name: 'produtos',
  domain: 'produtos-catalogo',
  dependencies: [],
  routes: ['GET /produtos', 'GET /produtos/search', 'GET /produtos/:id', 'PATCH /produtos/:id', 'POST /produtos']
});
