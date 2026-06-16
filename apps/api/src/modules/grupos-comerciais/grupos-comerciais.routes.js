import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { addGrupoComercialClientesHandler, createGrupoComercialHandler, deleteGrupoComercialHandler, getGrupoComercialClientesHandler, getGrupoComercialHandler, getGruposComerciais, removeGrupoComercialClienteHandler, updateGrupoComercialHandler } from './grupos-comerciais.controller.js';

export function registerGruposComerciaisRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/grupos-comerciais', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await getGruposComerciais(ctx))) });
  router.registerRoute({ method: 'POST', path: '/grupos-comerciais', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await createGrupoComercialHandler(ctx))) });
  router.registerRoute({ method: 'GET', path: '/grupos-comerciais/:id', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await getGrupoComercialHandler(ctx))) });
  router.registerRoute({ method: 'PATCH', path: '/grupos-comerciais/:id', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await updateGrupoComercialHandler(ctx))) });
  router.registerRoute({ method: 'DELETE', path: '/grupos-comerciais/:id', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await deleteGrupoComercialHandler(ctx))) });
  router.registerRoute({ method: 'GET', path: '/grupos-comerciais/:id/clientes', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await getGrupoComercialClientesHandler(ctx))) });
  router.registerRoute({ method: 'POST', path: '/grupos-comerciais/:id/clientes', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await addGrupoComercialClientesHandler(ctx))) });
  router.registerRoute({ method: 'DELETE', path: '/grupos-comerciais/:id/clientes/:clienteId', domain: 'grupos-comerciais', handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await removeGrupoComercialClienteHandler(ctx))) });
}
