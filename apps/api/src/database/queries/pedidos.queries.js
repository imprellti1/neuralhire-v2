export const PedidosQueries = {
  ping() {
    return 'SELECT 1 AS ok';
  },
  list(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT
      id,
      account_id,
      cliente_id,
      vendedor_id,
      numero,
      status,
      origem,
      observacoes,
      total,
      metadata,
      created_at,
      updated_at,
      data_emissao,
      data_faturamento,
      comissao_principal_percentual,
      comissao_preposto_percentual
    FROM pedidos
    WHERE account_id = $1${extraWhere}
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`;
  },
  count(whereSql = '') {
    const extraWhere = whereSql ? ` WHERE ${whereSql}` : '';
    return `SELECT COUNT(*)::int AS total FROM pedidos${extraWhere}`;
  },
  getById() {
    return `SELECT
      id,
      account_id,
      cliente_id,
      vendedor_id,
      numero,
      status,
      origem,
      observacoes,
      total,
      metadata,
      created_at,
      updated_at,
      data_emissao,
      data_faturamento,
      comissao_principal_percentual,
      comissao_preposto_percentual
    FROM pedidos
    WHERE account_id = $1 AND id = $2
    LIMIT 1`;
  },
  listItensByPedidoId() {
    return `SELECT *
    FROM pedido_itens
    WHERE account_id = $1 AND pedido_id = $2
    ORDER BY created_at ASC`;
  },
  listClientesByIds() {
    return 'SELECT id, nome FROM clientes WHERE account_id = $1 AND id = ANY($2::uuid[])';
  },
  listVendedoresByIds() {
    return 'SELECT id, nome FROM vendedores WHERE account_id = $1 AND id = ANY($2::uuid[])';
  }
};
