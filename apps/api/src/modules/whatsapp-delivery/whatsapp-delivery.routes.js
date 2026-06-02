import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { sendWhatsappDeliveryHandler, whatsappDeliveryWebhookHandler } from './whatsapp-delivery.controller.js';

export function registerWhatsappDeliveryRoutes(router) {
  router.registerRoute({ method: 'POST', path: '/whatsapp-delivery/send', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await sendWhatsappDeliveryHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/whatsapp-delivery/webhook', domain: 'whatsapp', handler: asyncHandler(async (_, res, context) => sendSuccess(res, await whatsappDeliveryWebhookHandler(context))) });
}
