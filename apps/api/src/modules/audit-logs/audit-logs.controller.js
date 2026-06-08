import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { getAuditLogById, getAuditLogsRepositoryMode, listAuditLogs } from './audit-logs.repository.js';

export async function getAuditLogs(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  const filters = {
    modulo: query.modulo,
    entidade: query.entidade,
    entidade_id: query.entidade_id || query.entidadeId,
    acao: query.acao,
    user_id: query.user_id || query.userId,
    status: query.status,
    data_inicial: query.data_inicial || query.dataInicial || query.startDate,
    data_final: query.data_final || query.dataFinal || query.endDate,
    search: query.search,
    page: query.page !== undefined ? Number(query.page) : undefined,
    limit: query.limit !== undefined ? Number(query.limit) : undefined
  };
  const result = await listAuditLogs(filters, { accountId, context });
  return { ok: true, repositoryMode: getAuditLogsRepositoryMode(), pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages }, items: result.items };
}

export async function getAuditLog(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  return { ok: true, repositoryMode: getAuditLogsRepositoryMode(), item: await getAuditLogById(id, { accountId, context }) };
}
