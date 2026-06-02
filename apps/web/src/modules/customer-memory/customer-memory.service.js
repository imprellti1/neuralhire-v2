export async function getCustomerMemory(api, acct, clienteId) {
  return api.get(`/accounts/${acct}/customer-memory/${clienteId}`);
}

export async function getCustomerMemorySummary(api, acct, clienteId) {
  return api.get(`/accounts/${acct}/customer-memory/${clienteId}/summary`);
}

export async function rebuildCustomerMemory(api, acct, clienteId) {
  return api.post(`/accounts/${acct}/customer-memory/${clienteId}/rebuild`);
}
