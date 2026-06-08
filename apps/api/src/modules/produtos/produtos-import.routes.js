import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { executeProdutosImportHandler, previewProdutosImportHandler } from './produtos-import.controller.js';

export function registerProdutosImportRoutes(router) {
  router.registerRoute({
    method: 'POST',
    path: '/produtos/importar-estoque/preview',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => sendSuccess(res, await previewProdutosImportHandler(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/produtos/importar-estoque',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => sendSuccess(res, await executeProdutosImportHandler(context)))
  });
}
