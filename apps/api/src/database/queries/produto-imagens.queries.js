export const ProdutoImagensQueries = {
  ping() {
    return 'SELECT 1 AS ok';
  },
  list() {
    return `SELECT * FROM produto_imagens
      WHERE account_id = $1
        AND produto_id = $2
      ORDER BY principal DESC, ordem ASC, created_at ASC`;
  },
  getById() {
    return `SELECT * FROM produto_imagens
      WHERE account_id = $1
        AND produto_id = $2
        AND id = $3
      LIMIT 1`;
  },
  insert() {
    return `INSERT INTO produto_imagens (
      id, account_id, produto_id, variacao_id, url, storage_path, ordem, principal, tipo, metadata, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING *`;
  },
  update() {
    return `UPDATE produto_imagens SET
      variacao_id = $4,
      url = $5,
      storage_path = $6,
      ordem = $7,
      principal = $8,
      tipo = $9,
      metadata = $10,
      updated_at = $11
    WHERE account_id = $1
      AND produto_id = $2
      AND id = $3
    RETURNING *`;
  },
  delete() {
    return `DELETE FROM produto_imagens
      WHERE account_id = $1
        AND produto_id = $2
        AND id = $3`;
  },
  unsetPrincipal() {
    return `UPDATE produto_imagens SET principal = FALSE
      WHERE account_id = $1
        AND produto_id = $2
        AND COALESCE(variacao_id, '') = COALESCE($3, '')
        AND id <> COALESCE($4, id)`;
  },
  getPrincipalCount() {
    return `SELECT COUNT(*)::int AS total
      FROM produto_imagens
      WHERE account_id = $1
        AND produto_id = $2
        AND COALESCE(variacao_id, '') = COALESCE($3, '')`;
  }
};
