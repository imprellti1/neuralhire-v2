import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { executePedidosItensImportHandler, previewPedidosItensImportHandler } from './pedidos-itens.controller.js';

export function registerPedidosItensRoutes(router) {
  router.registerRoute({ method: 'POST', path: '/pedidos/itens/importacao/preview', domain: 'pedidos-comercial', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await previewPedidosItensImportHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/pedidos/itens/importacao', domain: 'pedidos-comercial', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await executePedidosItensImportHandler(context))) });
}
