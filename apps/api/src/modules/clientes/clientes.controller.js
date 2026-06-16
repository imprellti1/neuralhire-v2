import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { NotFoundError, ValidationError } from '../../core/errors.js';
import { applyOwnerFilter, canAccessAllTenantData } from '../../core/commercial-scope.js';
import { createCliente, getClienteById, getClientesRepositoryMode, listClientes, updateCliente } from './clientes.repository.js';
import { recordAuditLog } from '../../core/audit-logs.js';
import { getGruposComerciaisByClienteId } from '../grupos-comerciais/grupos-comerciais.repository.js';

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
  if (String(context?.auth?.role || '').toLowerCase() === 'sales') {
    body.vendedor_id = context?.auth?.userId || null;
  }
  if (!canAccessAllTenantData(context) && String(context?.auth?.role || '').toLowerCase() !== 'sales') {
    delete body.vendedor_id;
  }

  const item = await createCliente(body, { accountId, context });
  await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: item?.id || null, acao: 'criar', descricao: 'Cliente criado', status: 'success', sucesso: true, metadata: { cliente_id: item?.id || null, nome: item?.nome || body.nome || null } }).catch(() => null);
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
    const gruposComerciais = await getGruposComerciaisByClienteId(id, { accountId }).catch(() => []);
    return { ok: true, repositoryMode: getClientesRepositoryMode(), item: { ...item, gruposComerciais } };
  } catch (error) {
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN' || error?.code === 'VENDEDOR_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}

export async function updateClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  const body = { ...(context.body || {}) };
  delete body.account_id;
  delete body.accountId;
  if (String(context?.auth?.role || '').toLowerCase() === 'sales') {
    delete body.vendedor_id;
  }
  try {
    const item = await updateCliente(id, body, { accountId, context });
    await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: id, acao: 'editar', descricao: 'Cliente editado', status: 'success', sucesso: true, metadata: { cliente_id: id } }).catch(() => null);
    return { ok: true, repositoryMode: getClientesRepositoryMode(), item };
  } catch (error) {
    await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: id, acao: 'editar', descricao: 'Falha ao editar cliente', status: 'failed', sucesso: false, erro_codigo: error?.code || 'INTERNAL_SERVER_ERROR', erro_mensagem: error?.message || 'Erro ao editar cliente' }).catch(() => null);
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN' || error?.code === 'VENDEDOR_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}
