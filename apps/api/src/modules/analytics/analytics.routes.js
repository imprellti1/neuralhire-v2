import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getSalesTimelineHandler, getAnalyticsSummaryHandler, getTopCustomersHandler, getTopProductsHandler } from './analytics.controller.js';
import { analyticsPeriodSchema } from './analytics.schemas.js';

export function registerAnalyticsRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/analytics/summary', domain: 'analytics-comercial', schema: analyticsPeriodSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAnalyticsSummaryHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/analytics/products', domain: 'analytics-comercial', schema: analyticsPeriodSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getTopProductsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/analytics/customers', domain: 'analytics-comercial', schema: analyticsPeriodSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getTopCustomersHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/analytics/timeline', domain: 'analytics-comercial', schema: analyticsPeriodSchema, handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getSalesTimelineHandler(context))) });
}
