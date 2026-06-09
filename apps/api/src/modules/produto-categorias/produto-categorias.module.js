import { defineModule } from '../../core/module-contract.js';
export const produtoCategoriasModule = defineModule({ name: 'produto-categorias', domain: 'produtos-catalogo', dependencies: ['produtos'], routes: ['GET /produto-categorias', 'GET /produto-categorias/:id', 'POST /produto-categorias', 'PATCH /produto-categorias/:id', 'DELETE /produto-categorias/:id'] });
