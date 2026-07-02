import { recalculateClientCommercialHistory, recalculateClientsCommercialHistory, calcularScoreComercialCliente } from './clientes.repository.legacy.js';

export class ClientesMetricsRepository {
  recalculateClientCommercialHistory(clienteId, options = {}) {
    return recalculateClientCommercialHistory(clienteId, options);
  }

  recalculateClientsCommercialHistory(clienteIds = [], options = {}) {
    return recalculateClientsCommercialHistory(clienteIds, options);
  }

  calcularScoreComercialCliente(input = {}) {
    return calcularScoreComercialCliente(input);
  }
}

export const clientesMetricsRepository = new ClientesMetricsRepository();
