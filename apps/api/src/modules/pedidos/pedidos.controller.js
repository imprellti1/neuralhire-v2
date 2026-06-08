import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { applyOwnerFilter } from '../../core/commercial-scope.js';
import { createPedido, getPedidoById, getPedidoStatusHistory, getPedidosRepositoryMode, listPedidos, updatePedido, updatePedidoItens, updatePedidoStatus } from './pedidos.repository.js';
import { recordAuditLog } from '../../core/audit-logs.js';

export async function getPedidos(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  const filters = { page: query.page !== undefined ? Number(query.page) : undefined, limit: query.limit !== undefined ? Number(query.limit) : undefined, status: query.status, cliente_id: query.cliente_id };
  const result = await listPedidos(applyOwnerFilter(context, filters), { accountId, context });
  return { ok: true, repositoryMode: getPedidosRepositoryMode(), pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages }, items: result.items };
}

export async function getPedido(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const result = await getPedidoById(context.params?.id, { accountId, context });
  return { ok: true, repositoryMode: getPedidosRepositoryMode(), ...result };
}

export async function createPedidoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id; delete body.accountId;
  try {
    const result = await createPedido(body, { accountId, context });
    await recordAuditLog(context, { modulo: 'pedidos', entidade: 'pedido', entidade_id: result?.item?.id || null, acao: 'criar', descricao: 'Pedido criado', status: 'success', sucesso: true, metadata: { pedido_id: result?.item?.id || null } }).catch(() => null);
    return { ok: true, repositoryMode: getPedidosRepositoryMode(), ...result };
  } catch (error) {
    await recordAuditLog(context, { modulo: 'pedidos', entidade: 'pedido', acao: 'criar', descricao: 'Falha ao criar pedido', status: 'failed', sucesso: false, erro_codigo: error?.code || 'INTERNAL_SERVER_ERROR', erro_mensagem: error?.message || 'Erro ao criar pedido' }).catch(() => null);
    throw error;
  }
}

export async function updatePedidoStatusHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const result = await updatePedidoStatus(context.params?.id, context.body || {}, { accountId, context });
  return { ok: true, repositoryMode: getPedidosRepositoryMode(), ...result };
}

export async function updatePedidoItensHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id; delete body.accountId;
  const result = await updatePedidoItens(context.params?.id, body, { accountId, context });
  return { ok: true, repositoryMode: getPedidosRepositoryMode(), ...result };
}

export async function updatePedidoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id; delete body.accountId;
  const result = await updatePedido(context.params?.id, body, { accountId, context });
  return { ok: true, repositoryMode: getPedidosRepositoryMode(), ...result };
}

export async function getPedidoHistory(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const items = await getPedidoStatusHistory(context.params?.id, { accountId });
  return { ok: true, repositoryMode: getPedidosRepositoryMode(), items };
}
