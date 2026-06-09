import { getAccountIdFromContext } from '../../core/tenant-context.js';
import {
  createProduto,
  getProdutoById,
  getProdutosRepositoryMode,
  listProdutos,
  listProdutoVariacoes,
  searchProdutos
  ,updateProduto
} from './produtos.repository.js';
import { recordAuditLog } from '../../core/audit-logs.js';

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
    categoria_id: query.categoria_id || query.categoriaId || query.categoria,
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

export async function getProdutoVariacoes(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const produtoId = context.params?.produtoId || context.params?.id;
  const items = await listProdutoVariacoes(produtoId, { accountId });
  return { ok: true, repositoryMode: getProdutosRepositoryMode(), items };
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
  try {
    const item = await createProduto(body, { accountId });
    await recordAuditLog(context, { modulo: 'produtos', entidade: 'produto', entidade_id: item?.id || null, acao: 'criar', descricao: 'Produto criado', status: 'success', sucesso: true, metadata: { produto_id: item?.id || null, nome: item?.nome || body.nome || null } });
    return { ok: true, repositoryMode: getProdutosRepositoryMode(), item };
  } catch (error) {
    await recordAuditLog(context, { modulo: 'produtos', entidade: 'produto', acao: 'criar', descricao: 'Falha ao criar produto', status: 'failed', sucesso: false, erro_codigo: error?.code || 'INTERNAL_SERVER_ERROR', erro_mensagem: error?.message || 'Erro ao criar produto', metadata: { nome: body.nome || null } }).catch(() => null);
    throw error;
  }
}

export async function updateProdutoHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id; delete body.accountId; delete body.tenant_id; delete body.tenantId; delete body.owner_user_id; delete body.ownerUserId;
  try {
    const item = await updateProduto(context.params?.id, body, { accountId });
    await recordAuditLog(context, { modulo: 'produtos', entidade: 'produto', entidade_id: context.params?.id || item?.id || null, acao: 'editar', descricao: 'Produto editado', status: 'success', sucesso: true, metadata: { produto_id: context.params?.id || item?.id || null } });
    return { ok: true, repositoryMode: getProdutosRepositoryMode(), item };
  } catch (error) {
    await recordAuditLog(context, { modulo: 'produtos', entidade: 'produto', entidade_id: context.params?.id || null, acao: 'editar', descricao: 'Falha ao editar produto', status: 'failed', sucesso: false, erro_codigo: error?.code || 'INTERNAL_SERVER_ERROR', erro_mensagem: error?.message || 'Erro ao editar produto' }).catch(() => null);
    throw error;
  }
}
