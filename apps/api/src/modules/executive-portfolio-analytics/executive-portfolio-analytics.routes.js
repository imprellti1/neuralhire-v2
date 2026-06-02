import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getExecutivePortfolioAnalyticsHandler } from './executive-portfolio-analytics.controller.js';

export function registerExecutivePortfolioAnalyticsRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/executive-portfolio-analytics',
    domain: 'customer-success',
    handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await getExecutivePortfolioAnalyticsHandler(ctx)))
  });
}
