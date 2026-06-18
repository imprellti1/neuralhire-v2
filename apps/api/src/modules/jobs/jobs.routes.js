import { asyncHandler } from '../../core/async-handler.js';
import { sendJson, sendSuccess } from '../../core/response.js';
import { getJobDetailAdmin, getJobsListAdmin, getJobsRunsAdmin, runJobManualAdmin } from './jobs.controller.js';

export function registerJobsRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/jobs', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobsListAdmin(context))) });
  router.registerRoute({ method: 'GET', path: '/jobs/runs', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobsRunsAdmin(context))) });
  router.registerRoute({
    method: 'POST',
    path: '/jobs/:id/run',
    domain: 'system-jobs',
    handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin(context)))
  });
  router.registerRoute({ method: 'POST', path: '/jobs/radar-comercial/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'radar_comercial_diario' } }))) });
  router.registerRoute({ method: 'POST', path: '/jobs/clientes-enriquecimento/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'clientes_enriquecimento_automatico' } }))) });
  router.registerRoute({ method: 'POST', path: '/jobs/clientes-geolocalizacao/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'clientes_geolocalizacao_automatico' } }))) });
  router.registerRoute({ method: 'POST', path: '/jobs/notificacoes-resumo-semanal/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'notificacoes_resumo_semanal' } }))) });
  router.registerRoute({ method: 'POST', path: '/jobs/gerente-comercial-observacao/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'gerente_comercial_observacao' } }))) });
  router.registerRoute({ method: 'POST', path: '/jobs/gerente-produtos-observacao/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'gerente_produtos_observacao' } }))) });
  router.registerRoute({ method: 'POST', path: '/jobs/gerente-auditoria-observacao/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'gerente_auditoria_observacao' } }))) });
  router.registerRoute({ method: 'POST', path: '/jobs/gerente-administrativo-observacao/run', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendJson(res, 202, await runJobManualAdmin({ ...context, params: { ...(context.params || {}), id: 'gerente_administrativo_observacao' } }))) });
  router.registerRoute({ method: 'GET', path: '/jobs/:id', domain: 'system-jobs', handler: asyncHandler(async (req, res, context) => sendSuccess(res, await getJobDetailAdmin(context))) });
}
