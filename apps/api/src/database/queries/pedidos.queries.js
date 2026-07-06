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
  insertPedido() {
    return `INSERT INTO pedidos (
      account_id,
      cliente_id,
      vendedor_id,
      numero,
      status,
      origem,
      observacoes,
      total,
      metadata,
      owner_user_id,
      data_emissao,
      data_faturamento
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
  updateTotal() {
    return `UPDATE pedidos
    SET total = $3,
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
  updatePedido() {
    return `UPDATE pedidos
    SET cliente_id = $3,
        origem = $4,
        observacoes = $5,
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
  updatePedidoVendedor() {
    return `UPDATE pedidos
    SET vendedor_id = $3,
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
  updatePedidoComissao() {
    return `UPDATE pedidos
    SET comissao_principal_percentual = COALESCE($3, comissao_principal_percentual),
        comissao_preposto_percentual = COALESCE($4, comissao_preposto_percentual),
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
  updatePedidoFaturamento() {
    return `UPDATE pedidos
    SET data_faturamento = $3,
        status = $4,
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
  deleteItensByPedidoId() {
    return `DELETE FROM pedido_itens
    WHERE account_id = $1
      AND pedido_id = $2`;
  },
  insertPedidoItem() {
    return `INSERT INTO pedido_itens (
      account_id,
      pedido_id,
      produto_id,
      produto_nome,
      sku,
      quantidade,
      preco_unitario,
      desconto,
      subtotal,
      total,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`;
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
  countItensByPedidoIds() {
    return `SELECT
      pedido_id,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(status_vinculo, '') <> 'vinculado')::int AS nao_vinculados
    FROM pedido_itens
    WHERE account_id = $1
      AND pedido_id = ANY($2::uuid[])
    GROUP BY pedido_id`;
  },
  countPedidosAuditoria(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT COUNT(*)::int AS total
    FROM pedidos
    WHERE account_id = $1${extraWhere}`;
  },
  listClientesByIds() {
    return 'SELECT id, nome FROM clientes WHERE account_id = $1 AND id = ANY($2::uuid[])';
  },
  listVendedoresByIds() {
    return 'SELECT id, nome FROM vendedores WHERE account_id = $1 AND id = ANY($2::uuid[])';
  }
};
