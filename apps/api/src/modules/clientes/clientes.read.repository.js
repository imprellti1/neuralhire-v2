import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import { ClientesReadQueries } from '../../database/queries/clientes-read.queries.js';

function normalizePedidoIds(pedidoIds = []) {
  return [...new Set((Array.isArray(pedidoIds) ? pedidoIds : [pedidoIds]).map((id) => String(id || '').trim()).filter(Boolean))];
}

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
  }
}

export class ClientesReadRepository extends BaseRepository {
  constructor(databaseAdapter) {
    super(databaseAdapter, { logContext: 'clientes-read' });
  }

  getById(id, options = {}) {
    assertAccountId(options.accountId || null);
    return this.one(ClientesReadQueries.getById(), [options.accountId || null, id]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') {
        throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
      }
      throw error;
    });
  }

  getDetails(id, options = {}) {
    return this.getById(id, options);
  }

  findByDocument(documento, options = {}) {
    return this.getDetailsByDocument(documento, options);
  }

  async getDetailsByDocument(documento, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    try {
      return await this.one(ClientesReadQueries.getByDocument(), [accountId, documento]);
    } catch (error) {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      throw error;
    }
  }

  listClientePedidos(accountId, clienteId) {
    assertAccountId(accountId);
    return this.many(ClientesReadQueries.listPedidosByCliente(), [accountId, clienteId]);
  }

  listClientePedidoItens(accountId, pedidoIds = [], pedidosFallback = []) {
    assertAccountId(accountId);
    void pedidosFallback;
    const ids = normalizePedidoIds(pedidoIds);
    if (!ids.length) return [];
    return this.many(ClientesReadQueries.listPedidoItensByPedidos(), [accountId, ids]);
  }
}

export const clientesReadRepository = new ClientesReadRepository(database);
