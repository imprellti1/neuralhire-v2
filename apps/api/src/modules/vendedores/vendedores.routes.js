import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { requirePermission } from '../../core/rbac.middleware.js';
import { requireTenant } from '../../core/tenant.middleware.js';
import { createVendedorHandler, getVendedor, getVendedorFabricantesHandler, getVendedores, updateVendedorFabricantesHandler, updateVendedorHandler, updateVendedorStatusHandler } from './vendedores.controller.js';
import { createVendedorSchema, updateVendedorFabricantesSchema, updateVendedorSchema, updateVendedorStatusSchema } from './vendedores.schemas.js';

export function registerVendedoresRoutes(router) {
  const readMiddlewares = [requirePermission('vendedores:read'), requireTenant({ domain: 'vendedores' })];
  const writeMiddlewares = [requirePermission('vendedores:write'), requireTenant({ domain: 'vendedores' })];
  const createMiddlewares = [requirePermission('vendedores:create'), requireTenant({ domain: 'vendedores' })];
  router.registerRoute({ method: 'GET', path: '/vendedores', domain: 'vendedores', middlewares: readMiddlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getVendedores(context))) });
  router.registerRoute({ method: 'GET', path: '/vendedores/:id', domain: 'vendedores', middlewares: readMiddlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getVendedor(context))) });
  router.registerRoute({ method: 'POST', path: '/vendedores', domain: 'vendedores', middlewares: createMiddlewares, schema: createVendedorSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createVendedorHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/vendedores/:id', domain: 'vendedores', middlewares: writeMiddlewares, schema: updateVendedorSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateVendedorHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/vendedores/:id/status', domain: 'vendedores', middlewares: writeMiddlewares, schema: updateVendedorStatusSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateVendedorStatusHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/vendedores/:id/fabricantes', domain: 'vendedores', middlewares: readMiddlewares, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getVendedorFabricantesHandler(context))) });
  router.registerRoute({ method: 'PUT', path: '/vendedores/:id/fabricantes', domain: 'vendedores', middlewares: writeMiddlewares, schema: updateVendedorFabricantesSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updateVendedorFabricantesHandler(context))) });
}
