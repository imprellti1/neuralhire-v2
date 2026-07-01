import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { discoverClienteWebsite } from './discovery.service.js';

export function registerWebDiscoveryRoutes(router) {
  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/web-discovery',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      const result = await discoverClienteWebsite({ clienteId: context?.params?.id, accountId: context?.auth?.accountId, fetchImpl: context.fetchImpl });
      sendSuccess(res, { data: result });
    })
  });
}
