import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { executePriceTableImportHandler, previewPriceTableImportHandler } from './price-table-import.controller.js';

export function registerPriceTableImportRoutes(router) {
  router.registerRoute({
    method: 'POST',
    path: '/produtos/importacao-tabela-preco/preview',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => sendSuccess(res, await previewPriceTableImportHandler(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/produtos/importacao-tabela-preco',
    domain: 'produtos-catalogo',
    handler: asyncHandler(async (req, res, context) => sendSuccess(res, await executePriceTableImportHandler(context)))
  });
}
