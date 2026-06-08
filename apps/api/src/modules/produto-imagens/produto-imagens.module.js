import { defineModule } from '../../core/module-contract.js';
export const produtoImagensModule = defineModule({ name: 'produto-imagens', domain: 'produtos-catalogo', dependencies: ['produtos'], routes: ['GET /produtos/:produtoId/imagens', 'POST /produtos/:produtoId/imagens', 'PATCH /produtos/:produtoId/imagens/:imagemId', 'DELETE /produtos/:produtoId/imagens/:imagemId'] });
