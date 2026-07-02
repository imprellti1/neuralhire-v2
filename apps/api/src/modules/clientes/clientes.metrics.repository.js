import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { ClientesMetricsQueries } from '../../database/queries/clientes-metrics.queries.js';
import { calcularScoreCliente } from './clientes.score.service.js';

const validStatuses = ['cancelado', 'rejeitado', 'estornado'];

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
  }
}

function normalizeIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map((id) => String(id || '').trim()).filter(Boolean))];
}

function isValidCommercialPedido(pedido = {}) {
  const status = String(pedido.status || '').trim().toLowerCase();
  if (!status) return false;
  if (validStatuses.includes(status)) return false;
  const metadata = pedido.metadata && typeof pedido.metadata === 'object' ? pedido.metadata : {};
  if (validStatuses.includes(String(metadata.status || '').trim().toLowerCase())) return false;
  if (validStatuses.includes(String(metadata.situacao || '').trim().toLowerCase())) return false;
  return true;
}

function normalizeDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function computeCommercialStatusFromDays(daysSinceLastPurchase) {
  if (!Number.isFinite(daysSinceLastPurchase)) return 'sem_pedido';
  if (daysSinceLastPurchase <= 60) return 'ativo';
  if (daysSinceLastPurchase <= 120) return 'em_risco';
  return 'inativo';
}

function resolvePurchaseDate(pedido = {}) {
  return normalizeDateValue(pedido.data_faturamento) || normalizeDateValue(pedido.data_emissao) || normalizeDateValue(pedido.created_at) || normalizeDateValue(pedido.createdAt);
}

export class ClientesMetricsRepository extends BaseRepository {
  constructor(databaseAdapter) {
    super(databaseAdapter, { logContext: 'clientes-metrics' });
  }

  async getClienteById(accountId, clienteId) {
    try {
      return await this.one(ClientesMetricsQueries.getById(), [accountId, clienteId]);
    } catch (error) {
      if (error?.code === 'DATABASE_NOT_ONE') {
        throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
      }
      throw error;
    }
  }

  listClientePedidos(accountId, clienteId) {
    return this.many(ClientesMetricsQueries.listPedidosByCliente(), [accountId, clienteId]);
  }

  listClientePedidoItens(accountId, pedidoIds = []) {
    const ids = normalizeIds(pedidoIds);
    if (!ids.length) return [];
    return this.many(ClientesMetricsQueries.listPedidoItensByPedidos(), [accountId, ids]);
  }

  async recalculateClientCommercialHistory(clienteId, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    const cliente = await this.getClienteById(accountId, clienteId);
    const pedidos = await this.listClientePedidos(accountId, cliente.id);
    const pedidosValidos = (Array.isArray(pedidos) ? pedidos : []).filter(isValidCommercialPedido);

    if (!pedidosValidos.length) {
      return this.one(ClientesMetricsQueries.updateCommercialHistory(), [accountId, cliente.id, null, 'sem_pedido']);
    }

    const compras = pedidosValidos
      .map((pedido) => ({ pedido, data: resolvePurchaseDate(pedido) }))
      .filter((entry) => entry.data)
      .sort((a, b) => b.data.getTime() - a.data.getTime());

    if (!compras.length) {
      return this.one(ClientesMetricsQueries.updateCommercialHistory(), [accountId, cliente.id, null, 'sem_pedido']);
    }

    const ultimaCompra = compras[0].data;
    const hoje = options.now instanceof Date ? options.now : new Date(options.now || new Date());
    const diffMs = hoje.getTime() - ultimaCompra.getTime();
    const daysSinceLastPurchase = Number.isFinite(diffMs) ? Math.floor(diffMs / 86400000) : Number.NaN;
    const statusComercial = computeCommercialStatusFromDays(daysSinceLastPurchase);
    return this.one(ClientesMetricsQueries.updateCommercialHistory(), [accountId, cliente.id, ultimaCompra.toISOString(), statusComercial]);
  }

  async recalculateClientsCommercialHistory(clienteIds = [], options = {}) {
    const uniqueIds = normalizeIds(clienteIds);
    const results = [];
    const warnings = [];
    for (const clienteId of uniqueIds) {
      try {
        results.push(await this.recalculateClientCommercialHistory(clienteId, options));
      } catch (error) {
        warnings.push({ clienteId, error: error?.message || String(error) });
      }
    }
    if (warnings.length) results.warnings = warnings;
    return results;
  }

  async calcularScoreComercialCliente(input = {}) {
    const accountId = input.accountId || null;
    assertAccountId(accountId);
    const cliente = await this.getClienteById(accountId, input.clienteId);
    const pedidos = await this.listClientePedidos(accountId, cliente.id);
    const pedidosValidos = (Array.isArray(pedidos) ? pedidos : []).filter(isValidCommercialPedido);
    const itens = await this.listClientePedidoItens(accountId, pedidosValidos.map((pedido) => pedido.id));
    const scoreResult = calcularScoreCliente({ cliente, pedidos: pedidosValidos, itens });
    const updated = await this.one(ClientesMetricsQueries.updateCommercialScore(), [
      accountId,
      cliente.id,
      scoreResult.score,
      scoreResult.classificacao,
      scoreResult.potencial,
      new Date().toISOString(),
      scoreResult.fatores
    ]);
    return { cliente: updated, score: scoreResult };
  }
}

export const clientesMetricsRepository = new ClientesMetricsRepository(database);
