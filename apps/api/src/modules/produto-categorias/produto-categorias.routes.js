import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requirePermission } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import { createProdutoCategoriaHandler, getProdutoCategoria, getProdutoCategorias, updateProdutoCategoriaHandler } from './produto-categorias.controller.js';

export function registerProdutoCategoriasRoutes(router) {
  const middlewares = [requirePermission('produtos:write'), requireTenant({ domain: 'produtos-catalogo' })];
  const read = [requirePermission('produtos:read'), requireTenant({ domain: 'produtos-catalogo' })];
  router.registerRoute({ method: 'GET', path: '/produto-categorias', domain: 'produtos-catalogo', middlewares: read, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await getProdutoCategorias(context))) });
  router.registerRoute({ method: 'GET', path: '/produto-categorias/:id', domain: 'produtos-catalogo', middlewares: read, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await getProdutoCategoria(context))) });
  router.registerRoute({ method: 'POST', path: '/produto-categorias', domain: 'produtos-catalogo', middlewares, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await createProdutoCategoriaHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/produto-categorias/:id', domain: 'produtos-catalogo', middlewares, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await updateProdutoCategoriaHandler(context))) });
}
