import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { createPedidoHandler, getPedido, getPedidoHistory, getPedidos, updatePedidoHandler, updatePedidoItensHandler, updatePedidoStatusHandler } from './pedidos.controller.js';
import { createPedidoSchema, updatePedidoItensSchema, updatePedidoSchema, updatePedidoStatusSchema } from './pedidos.schemas.js';

export function registerPedidosRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/pedidos', domain: 'pedidos-comercial', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getPedidos(context))) });
  router.registerRoute({ method: 'GET', path: '/pedidos/:id', domain: 'pedidos-comercial', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getPedido(context))) });
  router.registerRoute({ method: 'GET', path: '/pedidos/:id/history', domain: 'pedidos-comercial', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getPedidoHistory(context))) });
  router.registerRoute({ method: 'POST', path: '/pedidos', domain: 'pedidos-comercial', schema: createPedidoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await createPedidoHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/pedidos/:id', domain: 'pedidos-comercial', schema: updatePedidoSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updatePedidoHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/pedidos/:id/status', domain: 'pedidos-comercial', schema: updatePedidoStatusSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updatePedidoStatusHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/pedidos/:id/itens', domain: 'pedidos-comercial', schema: updatePedidoItensSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await updatePedidoItensHandler(context))) });
}
