import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requirePermission } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import {
  createCondicaoPagamentoHandler,
  deleteCondicaoPagamentoHandler,
  createFabricanteHandler,
  getCondicoesPagamento,
  getFabricante,
  getFabricantes,
  getFabricanteVendedores,
  lookupCnpjHandler,
  replaceFabricanteVendedoresHandler,
  deleteFabricanteVendedorHandler,
  updateFabricanteVendedorHandler,
  updateFabricanteLogoHandler,
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
  const readMiddlewares = [requirePermission('fabricantes:read'), requireTenant({ domain: 'fabricantes' })];
  const writeMiddlewares = [requirePermission('fabricantes:write'), requireTenant({ domain: 'fabricantes' })];

  router.registerRoute({ method: 'GET', path: '/fabricantes', domain: 'fabricantes', middlewares: readMiddlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getFabricantes(context))) });
  router.registerRoute({ method: 'GET', path: '/fabricantes/:id', domain: 'fabricantes', middlewares: readMiddlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getFabricante(context))) });
  router.registerRoute({ method: 'POST', path: '/fabricantes', domain: 'fabricantes', middlewares: writeMiddlewares, schema: createFabricanteSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createFabricanteHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/fabricantes/:id', domain: 'fabricantes', middlewares: writeMiddlewares, schema: updateFabricanteSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateFabricanteHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/fabricantes/:id/logo', domain: 'fabricantes', middlewares: writeMiddlewares, schema: null, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateFabricanteLogoHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/fabricantes/:id/condicoes-pagamento', domain: 'fabricantes', middlewares: readMiddlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getCondicoesPagamento(context))) });
  router.registerRoute({ method: 'POST', path: '/fabricantes/:id/condicoes-pagamento', domain: 'fabricantes', middlewares: writeMiddlewares, schema: createCondicaoPagamentoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createCondicaoPagamentoHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/fabricantes/:id/condicoes-pagamento/:condicaoId', domain: 'fabricantes', middlewares: writeMiddlewares, schema: updateCondicaoPagamentoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateCondicaoPagamentoHandler(context))) });
  router.registerRoute({ method: 'DELETE', path: '/fabricantes/:id/condicoes-pagamento/:condicaoId', domain: 'fabricantes', middlewares: writeMiddlewares, schema: null, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await deleteCondicaoPagamentoHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/fabricantes/:id/vendedores', domain: 'fabricantes', middlewares: readMiddlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getFabricanteVendedores(context))) });
  router.registerRoute({ method: 'PUT', path: '/fabricantes/:id/vendedores', domain: 'fabricantes', middlewares: writeMiddlewares, schema: null, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await replaceFabricanteVendedoresHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/fabricantes/:id/vendedores/:vendedorId', domain: 'fabricantes', middlewares: writeMiddlewares, schema: null, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateFabricanteVendedorHandler(context))) });
  router.registerRoute({ method: 'DELETE', path: '/fabricantes/:id/vendedores/:vendedorId', domain: 'fabricantes', middlewares: writeMiddlewares, schema: null, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await deleteFabricanteVendedorHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/cnpj/:cnpj', domain: 'fabricantes', middlewares: [requirePermission('fabricantes:read'), requireTenant({ domain: 'fabricantes' })], schema: null, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await lookupCnpjHandler(context))) });
}
