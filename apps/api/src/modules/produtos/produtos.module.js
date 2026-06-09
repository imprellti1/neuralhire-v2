import { defineModule } from '../../core/module-contract.js';

export const produtosModule = defineModule({
  name: 'produtos',
  domain: 'produtos-catalogo',
  dependencies: [],
  routes: ['GET /produtos', 'GET /produtos/search', 'GET /produtos/:id', 'GET /produtos/:produtoId/variacoes', 'POST /produto-variacoes/:variacaoId/imagem', 'PATCH /produtos/:id', 'POST /produtos']
});
