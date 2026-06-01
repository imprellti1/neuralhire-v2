import { sendError } from './response.js';

export function asyncHandler(handler) {
  return async (req, res, context) => {
    try {
      await handler(req, res, context);
    } catch (error) {
      sendError(res, error, context);
    }
  };
}
