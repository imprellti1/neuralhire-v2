import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { createPromocaoHandler, deletePromocaoHandler, getProdutoPromocoesHandler, getPromocaoHandler, getPromocoesHandler, updatePromocaoHandler } from './promocoes.controller.js';
import { createPromocaoSchema, updatePromocaoSchema } from './promocoes.schemas.js';

export function registerPromocoesRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/promocoes', domain: 'promocoes', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getPromocoesHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/promocoes/:id', domain: 'promocoes', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getPromocaoHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/promocoes', domain: 'promocoes', schema: createPromocaoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createPromocaoHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/promocoes/:id', domain: 'promocoes', schema: updatePromocaoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updatePromocaoHandler(context))) });
  router.registerRoute({ method: 'DELETE', path: '/promocoes/:id', domain: 'promocoes', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await deletePromocaoHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/produtos/:id/promocoes', domain: 'promocoes', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getProdutoPromocoesHandler(context))) });
}

