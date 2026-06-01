export function mapPedidoCreatePayload(state = {}) {
  const itens = Array.isArray(state.itens) ? state.itens : [];
  return {
    cliente_id: state.clienteId,
    origem: state.origem || 'manual',
    observacoes: state.observacoes || undefined,
    itens: itens.map((item) => ({
      produto_id: item.produtoId,
      quantidade: Number(item.quantidade || 0),
      desconto: Number(item.desconto || 0)
    }))
  };
}
