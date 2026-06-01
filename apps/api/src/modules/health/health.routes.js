import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getHealthStatus } from './health.controller.js';

export function registerHealthRoutes(router) {
  router.get('/health', asyncHandler(async (req, res) => {
    sendSuccess(res, getHealthStatus());
  }));
}
