export async function getActivationStatus(apiClient, acct){ return apiClient.get(`/accounts/${acct}/activation-status`); }
export async function listActivationClientes(apiClient){ return apiClient.get('/clientes'); }
export async function listActivationProdutos(apiClient){ return apiClient.get('/produtos'); }
export async function listActivationPedidos(apiClient){ return apiClient.get('/pedidos'); }
