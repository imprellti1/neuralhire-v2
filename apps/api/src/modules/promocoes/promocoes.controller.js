import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { createPromocao, deletePromocao, getPromocaoById, listPromocoes, listPromocoesDoProduto, updatePromocao } from './promocoes.repository.js';

function sanitizeBody(body = {}) {
  const copy = { ...(body || {}) };
  delete copy.account_id; delete copy.accountId; delete copy.tenant_id; delete copy.tenantId;
  return copy;
}

export async function getPromocoesHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const result = await listPromocoes(context.query || {}, { accountId });
  return { ok: true, items: result.items, total: result.total };
}

export async function getPromocaoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await getPromocaoById(context.params?.id, { accountId }) };
}

export async function createPromocaoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await createPromocao(sanitizeBody(context.body || {}), { accountId }) };
}

export async function updatePromocaoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await updatePromocao(context.params?.id, sanitizeBody(context.body || {}), { accountId }) };
}

export async function deletePromocaoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await deletePromocao(context.params?.id, { accountId }) };
}

export async function getProdutoPromocoesHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await listPromocoesDoProduto(context.params?.id || context.params?.produtoId, { accountId })) };
}

