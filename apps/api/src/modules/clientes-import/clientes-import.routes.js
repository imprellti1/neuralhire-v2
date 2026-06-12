import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { previewClientesImportHandler, executeClientesImportHandler } from './clientes-import.controller.js';

export function registerClientesImportRoutes(router) {
  router.registerRoute({
    method: 'POST',
    path: '/clientes/importacao/preview',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => sendSuccess(res, await previewClientesImportHandler(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/clientes/importacao',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => sendSuccess(res, await executeClientesImportHandler(context)))
  });
}
