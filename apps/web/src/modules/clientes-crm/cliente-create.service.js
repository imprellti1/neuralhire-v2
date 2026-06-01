import { mapClienteCreatePayload } from './cliente-create.mapper.js';

export async function createCliente(apiClient, state) {
  const payload = mapClienteCreatePayload(state);
  return apiClient.post('/clientes', payload);
}
