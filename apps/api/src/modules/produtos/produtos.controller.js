import { getAccountIdFromContext } from '../../core/tenant-context.js';
import {
  createProduto,
  getProdutoById,
  getProdutosRepositoryMode,
  listProdutos,
  searchProdutos
  ,updateProduto
} from './produtos.repository.js';

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export async function getProdutos(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  const filters = {
    page: query.page !== undefined ? Number(query.page) : undefined,
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    search: query.search,
    categoria: query.categoria,
    marca: query.marca,
    ativo: parseBoolean(query.ativo)
  };
  const result = await listProdutos(filters, { accountId });
  return {
    ok: true,
    repositoryMode: getProdutosRepositoryMode(),
    pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    items: result.items
  };
}

export async function getProduto(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = context.params?.id;
  const item = await getProdutoById(id, { accountId });
  return { ok: true, repositoryMode: getProdutosRepositoryMode(), item };
}

export async function searchProdutosHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const q = context.query?.q || context.query?.search || '';
  const result = await searchProdutos(q, { accountId });
  return { ok: true, repositoryMode: getProdutosRepositoryMode(), ...result };
}

export async function createProdutoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id; delete body.accountId; delete body.tenant_id; delete body.tenantId; delete body.owner_user_id; delete body.ownerUserId;
  const item = await createProduto(body, { accountId });
  return { ok: true, repositoryMode: getProdutosRepositoryMode(), item };
}

export async function updateProdutoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id; delete body.accountId; delete body.tenant_id; delete body.tenantId; delete body.owner_user_id; delete body.ownerUserId;
  const item = await updateProduto(context.params?.id, body, { accountId });
  return { ok: true, repositoryMode: getProdutosRepositoryMode(), item };
}
