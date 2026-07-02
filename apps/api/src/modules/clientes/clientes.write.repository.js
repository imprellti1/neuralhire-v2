import { createCliente, updateCliente, enrichClienteByCnpj, geolocalizarCliente, calcularScoreComercialCliente } from './clientes.repository.legacy.js';

export class ClientesWriteRepository {
  create(data, options = {}) {
    return createCliente(data, options);
  }

  update(id, data, options = {}) {
    return updateCliente(id, data, options);
  }

  patch(id, data, options = {}) {
    return updateCliente(id, data, options);
  }

  deleteOrArchive(id, data = {}, options = {}) {
    return updateCliente(id, { ...data, ativo: false }, options);
  }

  updateDigitalEnrichment(id, data, options = {}) {
    return updateCliente(id, data, options);
  }

  enrichByCnpj(clienteId, options = {}) {
    return enrichClienteByCnpj(clienteId, options);
  }

  geolocalizarCliente(input = {}) {
    return geolocalizarCliente(input);
  }

  calcularScoreComercialCliente(input = {}) {
    return calcularScoreComercialCliente(input);
  }
}

export const clientesWriteRepository = new ClientesWriteRepository();
