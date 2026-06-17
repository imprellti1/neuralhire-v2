import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { calcularScoreClienteHandler, calcularSegmentacaoClienteHandler, createClienteHandler, enrichClienteHandler, geolocalizarClienteHandler, gerarAlertasClienteHandler, getAlertasClienteHandler, getClienteByIdHandler, getClientes, getTimelineClienteHandler, resolverAlertaClienteHandler, updateClienteHandler } from './clientes.controller.js';
import { createClienteSchema, updateClienteSchema } from './clientes.schemas.js';

export function registerClientesRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/clientes',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getClientes(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/clientes/:id',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getClienteByIdHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes',
    domain: 'clientes-crm',
    schema: createClienteSchema,
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await createClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'PATCH',
    path: '/clientes/:id',
    domain: 'clientes-crm',
    schema: updateClienteSchema,
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await updateClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/enriquecer',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await enrichClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/geolocalizar',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await geolocalizarClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/calcular-score',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await calcularScoreClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/calcular-segmentacao',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await calcularSegmentacaoClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/gerar-alertas',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await gerarAlertasClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/clientes/:id/alertas',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getAlertasClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/clientes/:id/timeline',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getTimelineClienteHandler(context));
    })
  });

  router.registerRoute({
    method: 'PATCH',
    path: '/clientes/alertas/:id/resolver',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await resolverAlertaClienteHandler(context));
    })
  });
}
