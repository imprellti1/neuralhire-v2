import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { executePedidosImportHandler, previewPedidosImportHandler } from './pedidos-import.controller.js';

export function registerPedidosImportRoutes(router) {
  router.registerRoute({ method: 'POST', path: '/pedidos/importacao/preview', domain: 'pedidos-comercial', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await previewPedidosImportHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/pedidos/importacao', domain: 'pedidos-comercial', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await executePedidosImportHandler(context))) });
}

