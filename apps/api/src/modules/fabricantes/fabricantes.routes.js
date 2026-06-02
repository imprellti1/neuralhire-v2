import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import {
  createCondicaoPagamentoHandler,
  createFabricanteHandler,
  getCondicoesPagamento,
  getFabricante,
  getFabricantes,
  updateCondicaoPagamentoHandler,
  updateFabricanteHandler
} from './fabricantes.controller.js';
import {
  createCondicaoPagamentoSchema,
  createFabricanteSchema,
  updateCondicaoPagamentoSchema,
  updateFabricanteSchema
} from './fabricantes.schemas.js';

export function registerFabricantesRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/fabricantes', domain: 'fabricantes', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getFabricantes(context))) });
  router.registerRoute({ method: 'GET', path: '/fabricantes/:id', domain: 'fabricantes', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getFabricante(context))) });
  router.registerRoute({ method: 'POST', path: '/fabricantes', domain: 'fabricantes', schema: createFabricanteSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createFabricanteHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/fabricantes/:id', domain: 'fabricantes', schema: updateFabricanteSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateFabricanteHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/fabricantes/:id/condicoes-pagamento', domain: 'fabricantes', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getCondicoesPagamento(context))) });
  router.registerRoute({ method: 'POST', path: '/fabricantes/:id/condicoes-pagamento', domain: 'fabricantes', schema: createCondicaoPagamentoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createCondicaoPagamentoHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/fabricantes/:id/condicoes-pagamento/:condicaoId', domain: 'fabricantes', schema: updateCondicaoPagamentoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateCondicaoPagamentoHandler(context))) });
}
