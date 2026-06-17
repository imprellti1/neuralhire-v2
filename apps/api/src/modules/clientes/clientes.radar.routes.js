import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getClientesRadarHandler } from './clientes.radar.controller.js';

export function registerClientesRadarRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/clientes/radar',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getClientesRadarHandler(context));
    })
  });
}
