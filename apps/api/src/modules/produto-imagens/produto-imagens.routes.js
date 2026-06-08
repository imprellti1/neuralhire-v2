import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requirePermission } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import { deleteProdutoImagemHandler, getProdutoImagens, patchProdutoImagem, postProdutoImagem } from './produto-imagens.controller.js';

export function registerProdutoImagensRoutes(router) {
  const m = [requirePermission('produtos:write'), requireTenant({ domain: 'produtos-catalogo' })];
  const r = [requirePermission('produtos:read'), requireTenant({ domain: 'produtos-catalogo' })];
  router.registerRoute({ method: 'GET', path: '/produtos/:produtoId/imagens', domain: 'produtos-catalogo', middlewares: r, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await getProdutoImagens(context))) });
  router.registerRoute({ method: 'POST', path: '/produtos/:produtoId/imagens', domain: 'produtos-catalogo', middlewares: m, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await postProdutoImagem(context))) });
  router.registerRoute({ method: 'PATCH', path: '/produtos/:produtoId/imagens/:imagemId', domain: 'produtos-catalogo', middlewares: m, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await patchProdutoImagem(context))) });
  router.registerRoute({ method: 'DELETE', path: '/produtos/:produtoId/imagens/:imagemId', domain: 'produtos-catalogo', middlewares: m, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await deleteProdutoImagemHandler(context))) });
}
