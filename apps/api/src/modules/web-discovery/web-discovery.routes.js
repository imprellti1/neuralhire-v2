import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { enrichClienteWebsite } from './digital-enrichment.service.js';

export function registerWebDiscoveryRoutes(router) {
  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/web-discovery',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      const result = await enrichClienteWebsite({ clienteId: context?.params?.id, accountId: context?.auth?.accountId, fetchImpl: context.fetchImpl, force: true });
      sendSuccess(res, { data: result });
    })
  });
}
