import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { applyOwnerFilter } from '../../core/commercial-scope.js';
import { createPedido, getPedidoById, getPedidoStatusHistory, getPedidosRepositoryMode, listPedidos, updatePedido, updatePedidoItens, updatePedidoStatus } from './pedidos.repository.js';

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
  const result = await createPedido(body, { accountId, context });
  return { ok: true, repositoryMode: getPedidosRepositoryMode(), ...result };
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
