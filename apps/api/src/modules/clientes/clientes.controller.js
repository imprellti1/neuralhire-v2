import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { NotFoundError, ValidationError } from '../../core/errors.js';
import { applyOwnerFilter, canAccessAllTenantData, resolveOwnerUserIdForCreate } from '../../core/commercial-scope.js';
import { createCliente, getClienteById, getClientesRepositoryMode, listClientes } from './clientes.repository.js';

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export async function getClientes(context = {}) {
  const query = context.query || {};
  const accountId = getAccountIdFromContext(context);
  const filters = {
    page: query.page !== undefined ? Number(query.page) : undefined,
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    search: query.search,
    ativo: parseBoolean(query.ativo)
  };
  const scopedFilters = applyOwnerFilter(context, filters);

  const result = await listClientes(scopedFilters, { accountId, context });
  return {
    ok: true,
    repositoryMode: getClientesRepositoryMode(),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages
    },
    items: result.items
  };
}

export async function createClienteHandler(context) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id;
  delete body.accountId;
  if (!canAccessAllTenantData(context)) {
    delete body.owner_user_id;
    delete body.vendedor_id;
  }
  body.owner_user_id = resolveOwnerUserIdForCreate(context, body);

  const item = await createCliente(body, { accountId, context });
  return {
    ok: true,
    repositoryMode: getClientesRepositoryMode(),
    item
  };
}

export async function getClienteByIdHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  try {
    const item = await getClienteById(id, { accountId, context });
    return { ok: true, repositoryMode: getClientesRepositoryMode(), item };
  } catch (error) {
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}
