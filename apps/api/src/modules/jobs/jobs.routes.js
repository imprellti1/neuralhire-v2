import { asyncHandler } from '../../core/async-handler.js';
import { sendJson, sendSuccess } from '../../core/response.js';
import { getJobDetailAdmin, getJobsListAdmin, getJobsRunsAdmin, runClientesEnriquecimentoAdmin, runClientesGeolocalizacaoAdmin, runGerenteComercialObservacaoAdmin, runNotificacoesResumoSemanalAdmin, runRadarComercialAdmin } from './jobs.controller.js';

export function registerJobsRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/jobs', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobsListAdmin(context))) });
  router.registerRoute({ method: 'GET', path: '/jobs/runs', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobsRunsAdmin(context))) });
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
  router.registerRoute({
    method: 'POST',
    path: '/jobs/notificacoes-resumo-semanal/run',
    domain: 'system-jobs',
    handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runNotificacoesResumoSemanalAdmin(context)))
  });
  router.registerRoute({
    method: 'POST',
    path: '/jobs/gerente-comercial-observacao/run',
    domain: 'system-jobs',
    handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runGerenteComercialObservacaoAdmin(context)))
  });
  router.registerRoute({ method: 'GET', path: '/jobs/:id', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobDetailAdmin(context))) });
}
