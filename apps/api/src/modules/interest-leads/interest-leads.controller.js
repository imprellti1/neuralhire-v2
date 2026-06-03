import { normalizeBulkLaunchBatchPayload, normalizeCreateInterestLeadPayload, normalizeEventPayload, normalizeInvitePayload, normalizeLaunchPreviewPayload, normalizeLaunchQueuePayload, normalizeLaunchTemplatePayload, normalizeLeadUpdatePayload, normalizeListFilters, normalizePatchLaunchTemplatePayload, normalizeStatusPayload } from './interest-leads.schemas.js';
import { bulkSetLaunchBatch, convertLeadToSubscriber, createInterestLead, createInterestLeadEvent, createLaunchTemplate, deleteLaunchTemplate, getInterestLeadById, getInterestLeadEvents, getInterestLeadsDashboard, getInterestLeadsLaunchDashboard, getInterestLeadsRepositoryMode, launchPreview, listInterestLeads, listInterestLeadsForExport, listLaunchTemplates, patchInterestLead, patchInterestLeadInvite, patchLaunchTemplate, queueLaunch, updateInterestLeadStatus } from './interest-leads.repository.js';
import { logger } from '../../core/logger.js';

export async function createInterestLeadHandler(context = {}) {
  const body = context.body || {};
  const payload = normalizeCreateInterestLeadPayload(body);

  logger.info('[interest-leads:create] request', {
    requestId: context.requestId || null,
    hasNome: Boolean(payload.nome),
    hasEmail: Boolean(payload.email),
    hasTelefone: Boolean(payload.whatsapp),
    empresaLength: payload.empresa?.length ?? 0,
    segmento: payload.segmento,
    vendedores: payload.quantidade_vendedores
  });

  try {
    const item = await createInterestLead(payload);
    return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item };
  } catch (error) {
    logger.error('[interest-leads:create] failed', {
      requestId: context.requestId || null,
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      name: error?.name
    });
    throw error;
  }
}
export async function listInterestLeadsHandler(context = {}) { const filters = normalizeListFilters(context.query || {}); const result = await listInterestLeads(filters); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), items: result.items, pagination: { page: filters.page, limit: filters.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / filters.limit)) } }; }
export async function getInterestLeadHandler(context = {}) { const id = String(context?.params?.id || '').trim(); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item: await getInterestLeadById(id) }; }
export async function patchInterestLeadStatusHandler(context = {}) { const id = String(context?.params?.id || '').trim(); const { status } = normalizeStatusPayload(context.body || {}); const item = await updateInterestLeadStatus(id, status); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function patchInterestLeadHandler(context = {}) { const id = String(context?.params?.id || '').trim(); const patch = normalizeLeadUpdatePayload(context.body || {}); if ((context.body || {}).observacao) patch.observacoes = String(context.body.observacao).trim(); const item = await patchInterestLead(id, patch); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function patchInterestLeadInviteHandler(context = {}) { const id = String(context?.params?.id || '').trim(); const payload = normalizeInvitePayload(context.body || {}); const item = await patchInterestLeadInvite(id, payload); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function bulkLaunchBatchHandler(context = {}) { const payload = normalizeBulkLaunchBatchPayload(context.body || {}); const items = await bulkSetLaunchBatch(payload.leadIds, payload.launchBatch); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), items }; }
export async function exportInterestLeadsCsvHandler(context = {}) { const filters = normalizeListFilters(context.query || {}); return listInterestLeadsForExport(filters); }
export async function getInterestLeadsDashboardHandler() { return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), ...(await getInterestLeadsDashboard()) }; }
export async function getInterestLeadsLaunchDashboardHandler() { return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), ...(await getInterestLeadsLaunchDashboard()) }; }
export async function listInterestLeadEventsHandler(context = {}) { const id = String(context?.params?.id || '').trim(); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), items: await getInterestLeadEvents(id) }; }
export async function createInterestLeadEventHandler(context = {}) { const id = String(context?.params?.id || '').trim(); const item = await createInterestLeadEvent(id, normalizeEventPayload(context.body || {})); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function listLaunchTemplatesHandler() { return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), items: await listLaunchTemplates() }; }
export async function createLaunchTemplateHandler(context = {}) { const item = await createLaunchTemplate(normalizeLaunchTemplatePayload(context.body || {})); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function patchLaunchTemplateHandler(context = {}) { const id = String(context?.params?.id || '').trim(); const item = await patchLaunchTemplate(id, normalizePatchLaunchTemplatePayload(context.body || {})); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function deleteLaunchTemplateHandler(context = {}) { const id = String(context?.params?.id || '').trim(); const item = await deleteLaunchTemplate(id); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function launchPreviewHandler(context = {}) { const item = await launchPreview(normalizeLaunchPreviewPayload(context.body || {})); return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), item }; }
export async function launchQueueHandler(context = {}) { return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), ...(await queueLaunch(normalizeLaunchQueuePayload(context.body || {}))) }; }
export async function convertInterestLeadHandler(context = {}) { const id = String(context?.params?.id || '').trim(); try { return { ok: true, repositoryMode: getInterestLeadsRepositoryMode(), ...(await convertLeadToSubscriber(id)) }; } catch (error) { if (error?.code === 'LEAD_ALREADY_CONVERTED') { error.statusCode = 409; } throw error; } }
