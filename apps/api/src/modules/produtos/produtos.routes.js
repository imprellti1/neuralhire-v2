import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { createProdutoHandler, getProduto, getProdutoVariacoes, getProdutos, searchProdutosHandler, updateProdutoHandler } from './produtos.controller.js';
import { createProdutoSchema, updateProdutoSchema } from './produtos.schemas.js';

export function registerProdutosRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/produtos',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getProdutos(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/produtos/search',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await searchProdutosHandler(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/produtos/:id',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getProduto(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/produtos/:produtoId/variacoes',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getProdutoVariacoes(context));
    })
  });

  router.registerRoute({
    method: 'PATCH',
    path: '/produtos/:id',
    domain: 'produtos-catalogo',
    schema: updateProdutoSchema,
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await updateProdutoHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/produtos',
    domain: 'produtos-catalogo',
    schema: createProdutoSchema,
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await createProdutoHandler(context));
    })
  });
}
