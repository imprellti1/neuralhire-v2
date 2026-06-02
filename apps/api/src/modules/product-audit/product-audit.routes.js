import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getProduct, getProducts, getSummary, patchFabricante, patchFix } from './product-audit.controller.js';

export function registerProductAuditRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/product-audit/summary', domain: 'product-audit', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getSummary(context))) });
  router.registerRoute({ method: 'GET', path: '/product-audit/products', domain: 'product-audit', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getProducts(context))) });
  router.registerRoute({ method: 'GET', path: '/product-audit/products/:productId', domain: 'product-audit', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getProduct(context))) });
  router.registerRoute({ method: 'PATCH', path: '/product-audit/products/:productId/fabricante', domain: 'product-audit', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await patchFabricante(context))) });
  router.registerRoute({ method: 'PATCH', path: '/product-audit/products/:productId/fix', domain: 'product-audit', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await patchFix(context))) });
}
