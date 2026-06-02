import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getPortfolioDashboardHandler } from './portfolio-dashboard.controller.js';

export function registerPortfolioDashboardRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/portfolio-dashboard',
    domain: 'customer-success',
    handler: asyncHandler(async (req, res, ctx) => sendSuccess(res, await getPortfolioDashboardHandler(ctx)))
  });
}
