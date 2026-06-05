import { sendError } from './response.js';
import { logger } from './logger.js';

export function asyncHandler(handler) {
  return async (req, res, context) => {
    try {
      await handler(req, res, context);
    } catch (error) {
      const route = context?.route?.path || req?.originalUrl || req?.url || null;
      logger.error({
        requestId: context?.requestId || null,
        route,
        message: error?.message,
        stack: error?.stack,
        cause: error?.cause
      });
      sendError(res, error, context);
    }
  };
}
