import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getClientesRadarHandler, recalcularClientesRadarHandler } from './clientes.radar.controller.js';

export function registerClientesRadarRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/clientes/radar',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getClientesRadarHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes/radar/recalcular',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await recalcularClientesRadarHandler(context));
    })
  });
}
