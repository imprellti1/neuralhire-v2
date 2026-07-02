import {
  getClienteById,
  getClientesRepositoryMode,
  listClientePedidos as legacyListClientePedidos,
  listClientePedidoItens as legacyListClientePedidoItens
} from './clientes.repository.legacy.js';

export class ClientesReadRepository {
  getById(id, options = {}) {
    return getClienteById(id, options);
  }

  getDetails(id, options = {}) {
    return getClienteById(id, options);
  }

  findByDocument(documento, options = {}) {
    return this.getDetailsByDocument(documento, options);
  }

  async getDetailsByDocument(documento, options = {}) {
    const repositoryMode = getClientesRepositoryMode();
    const accountId = options.accountId || null;
    if (repositoryMode.mode === 'supabase') {
      const cliente = await this._listByDocumentSupabase(documento, accountId, options);
      return cliente;
    }
    const cliente = await this._listByDocumentMemory(documento, accountId, options);
    return cliente;
  }

  async _listByDocumentSupabase(documento, accountId, options) {
    const { getSupabaseClient } = await import('../../database/supabase.client.js');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('clientes').select('*').eq('account_id', accountId).eq('documento', documento).maybeSingle();
    if (error) throw error;
    return data;
  }

  async _listByDocumentMemory(documento, accountId) {
    const { __dumpMemoryClientes } = await import('./clientes.repository.legacy.js');
    return __dumpMemoryClientes().find((item) => item.account_id === accountId && String(item.documento || '') === String(documento || '')) || null;
  }

  listClientePedidos(accountId, clienteId) {
    return legacyListClientePedidos(accountId, clienteId);
  }

  listClientePedidoItens(accountId, pedidoIds = [], pedidosFallback = []) {
    return legacyListClientePedidoItens(accountId, pedidoIds, pedidosFallback);
  }
}

export const clientesReadRepository = new ClientesReadRepository();
