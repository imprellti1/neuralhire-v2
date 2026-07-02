import { listClientes } from './clientes.repository.legacy.js';

export class ClientesSearchRepository {
  list(filters = {}, options = {}) {
    return listClientes(filters, options);
  }

  search(filters = {}, options = {}) {
    return listClientes(filters, options);
  }
}

export const clientesSearchRepository = new ClientesSearchRepository();
