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
  updateStatus() {
    return `UPDATE pedidos
    SET status = $3,
        updated_at = NOW()
    WHERE account_id = $1
      AND id = $2
    RETURNING
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
      comissao_preposto_percentual`;
  },
  insertStatusHistory() {
    return `INSERT INTO pedido_status_history (
      account_id,
      pedido_id,
      status_anterior,
      status_novo,
      motivo,
      alterado_por,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`;
  },
  listStatusHistoryByPedidoId() {
    return `SELECT *
    FROM pedido_status_history
    WHERE account_id = $1 AND pedido_id = $2
    ORDER BY created_at DESC`;
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
