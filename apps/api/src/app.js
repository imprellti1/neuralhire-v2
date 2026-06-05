import { createRequestContext } from './core/request-context.js';
import { logger } from './core/logger.js';
import { sendError } from './core/response.js';
import { createRouter } from './core/router.js';
import { runMiddlewares } from './core/middleware-runner.js';
import { corsMiddleware } from './core/cors.middleware.js';
import { securityHeadersMiddleware } from './core/security-headers.middleware.js';
import { authContextMiddleware } from './core/auth-context.middleware.js';
import { registerModules } from './modules/index.js';
import { env } from './config/env.js';

const globalMiddlewares = [
  corsMiddleware({ origin: env.CORS_ORIGIN }),
  securityHeadersMiddleware(),
  authContextMiddleware()
];

const globalMiddlewareNames = [
  'corsMiddleware',
  'securityHeadersMiddleware',
  'authContextMiddleware'
];

export function createApiApp() {
  const router = createRouter();
  registerModules(router, { globalMiddlewares: globalMiddlewareNames });

  return async (req, res) => {
    const context = createRequestContext(req);
    const started = Date.now();

    logger.info('request_started', {
      requestId: context.requestId,
      method: context.method,
      url: context.url
    });

    try {
      const shouldContinue = await runMiddlewares(globalMiddlewares, req, res, context);
      if (shouldContinue === false) {
        return;
      }

      await router.resolve(req, res, context);
    } catch (error) {
      sendError(res, error, context);
      logger.error({
        requestId: context.requestId,
        method: context.method,
        url: context.url,
        route: context?.route?.path || null,
        errorCode: error?.code || 'INTERNAL_SERVER_ERROR',
        message: error?.message || 'Erro nao identificado',
        stack: error?.stack,
        cause: error?.cause
      });
    } finally {
      logger.info('request_finished', {
        requestId: context.requestId,
        method: context.method,
        url: context.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - started
      });
    }
  };
}
