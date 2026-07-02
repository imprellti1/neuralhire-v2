import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { getClienteById } from '../clientes/clientes.repository.js';
import { enrichClienteWebsite } from './digital-enrichment.service.js';

export function registerWebDiscoveryRoutes(router) {
  router.registerRoute({
    method: 'POST',
    path: '/clientes/:id/web-discovery',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      const cliente = await getClienteById(context?.params?.id, { accountId: context?.auth?.accountId });
      const existingSite = String(cliente?.site || cliente?.website || '').trim();
      if (existingSite) {
        sendSuccess(res, {
          data: {
            found: true,
            site: existingSite,
            domain: new URL(existingSite).hostname.replace(/^www\./i, '').toLowerCase(),
            provider: 'existing',
            confidence: 1,
            payload: cliente.digital_enrichment_payload || {
              contacts: { emails: [], phones: [], whatsapp: [] },
              social: { instagram: [], facebook: [], linkedin: [], youtube: [], tiktok: [] },
              company: { description: '', segment: '', categories: [], brands: [], business_hours: '', address: '' },
              commercial: { has_ecommerce: false, has_catalog: false, product_links: [], marketplaces: [] },
              sources: [],
              confidence: { site: 100, emails: 0, phones: 0, social: 0, company: 0, commercial: 0 }
            },
            cliente,
            sources: []
          }
        });
        return;
      }
      const result = await enrichClienteWebsite({ clienteId: context?.params?.id, accountId: context?.auth?.accountId, fetchImpl: context.fetchImpl || globalThis.fetch, force: true });
      sendSuccess(res, { data: result });
    })
  });
}
