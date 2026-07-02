export const ClientesReadQueries = {
  getById() {
    return 'SELECT * FROM clientes WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  getByDocument() {
    return 'SELECT * FROM clientes WHERE account_id = $1 AND documento = $2 LIMIT 1';
  },
  listPedidosByCliente() {
    return `SELECT id, account_id, cliente_id, status, total, data_emissao, data_faturamento, metadata, created_at
      FROM pedidos
      WHERE account_id = $1 AND cliente_id = $2
      ORDER BY data_faturamento DESC NULLS LAST, data_emissao DESC NULLS LAST, created_at DESC
      LIMIT 250`;
  },
  listPedidoItensByPedidos() {
    return `SELECT *
      FROM pedido_itens
      WHERE account_id = $1 AND pedido_id = ANY($2)
      ORDER BY pedido_id ASC, id ASC`;
  }
};
