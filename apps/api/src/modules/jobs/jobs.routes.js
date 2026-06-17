import { asyncHandler } from '../../core/async-handler.js';
import { sendJson, sendSuccess } from '../../core/response.js';
import { getJobsAdmin, runClientesEnriquecimentoAdmin, runClientesGeolocalizacaoAdmin, runRadarComercialAdmin } from './jobs.controller.js';

export function registerJobsRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/jobs', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobsAdmin(context))) });
  router.registerRoute({
    method: 'POST',
    path: '/jobs/radar-comercial/run',
    domain: 'system-jobs',
    handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runRadarComercialAdmin(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/jobs/clientes-enriquecimento/run',
    domain: 'system-jobs',
    handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runClientesEnriquecimentoAdmin(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/jobs/clientes-geolocalizacao/run',
    domain: 'system-jobs',
    handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runClientesGeolocalizacaoAdmin(context)))
  });
}
