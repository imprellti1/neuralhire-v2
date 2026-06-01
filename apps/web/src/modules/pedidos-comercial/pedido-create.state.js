export function createPedidoCreateState() {
  return {
    loading: true,
    saving: false,
    error: '',
    success: '',
    clientes: [],
    produtos: [],
    clienteId: '',
    origem: 'manual',
    observacoes: '',
    itens: []
  };
}
