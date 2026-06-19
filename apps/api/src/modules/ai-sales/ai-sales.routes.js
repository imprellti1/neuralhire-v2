import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getAiSalesAlertsHandler, getAiSalesOpportunitiesHandler, getAiSalesOverviewHandler, getAiSalesPerformanceHandler, getAiSalesPortfolioHandler, getAiSalesTasksHandler } from './ai-sales.controller.js';

export function registerAiSalesRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/ai-sales/overview', domain: 'ai-sales', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiSalesOverviewHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-sales/portfolio', domain: 'ai-sales', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiSalesPortfolioHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-sales/alerts', domain: 'ai-sales', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiSalesAlertsHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-sales/tasks', domain: 'ai-sales', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiSalesTasksHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-sales/opportunities', domain: 'ai-sales', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiSalesOpportunitiesHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ai-sales/performance', domain: 'ai-sales', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getAiSalesPerformanceHandler(context))) });
}

