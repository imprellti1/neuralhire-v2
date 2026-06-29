import { asyncHandler } from '../../../core/async-handler.js';
import { sendSuccess } from '../../../core/response.js';
import { evolutionWebhookHandler } from './evolution.controller.js';
import { webhookAuthMiddleware } from '../../../middlewares/webhook-auth.middleware.js';

export function registerEvolutionRoutes(router) {
  router.registerRoute({
    method: 'POST',
    path: '/integrations/evolution/webhook',
    domain: 'whatsapp',
    middlewares: [webhookAuthMiddleware()],
    handler: asyncHandler(async (_, res, context) => sendSuccess(res, await evolutionWebhookHandler(context)))
  });
}
