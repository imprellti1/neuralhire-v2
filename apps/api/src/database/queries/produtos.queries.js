export const ProdutosQueries = {
  ping() {
    return 'SELECT 1 AS ok';
  },
  list({ hasSearch = false, hasCategoriaId = false, hasMarca = false, hasAtivo = false } = {}) {
    const clauses = ['account_id = $1'];
    let paramIndex = 2;
    if (hasSearch) clauses.push(`(nome ILIKE $${paramIndex++} OR sku ILIKE $${paramIndex++} OR codigo ILIKE $${paramIndex++} OR descricao ILIKE $${paramIndex++} OR marca ILIKE $${paramIndex++})`);
    if (hasCategoriaId) clauses.push(`categoria_id = $${paramIndex++}`);
    if (hasMarca) clauses.push(`marca = $${paramIndex++}`);
    if (hasAtivo) clauses.push(`ativo = $${paramIndex++}`);
    return `SELECT * FROM produtos WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  },
  count({ hasSearch = false, hasCategoriaId = false, hasMarca = false, hasAtivo = false } = {}) {
    const clauses = ['account_id = $1'];
    let paramIndex = 2;
    if (hasSearch) clauses.push(`(nome ILIKE $${paramIndex++} OR sku ILIKE $${paramIndex++} OR codigo ILIKE $${paramIndex++} OR descricao ILIKE $${paramIndex++} OR marca ILIKE $${paramIndex++})`);
    if (hasCategoriaId) clauses.push(`categoria_id = $${paramIndex++}`);
    if (hasMarca) clauses.push(`marca = $${paramIndex++}`);
    if (hasAtivo) clauses.push(`ativo = $${paramIndex++}`);
    return `SELECT COUNT(*)::int AS total FROM produtos WHERE ${clauses.join(' AND ')}`;
  },
  getById() {
    return 'SELECT * FROM produtos WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  insert() {
    return `INSERT INTO produtos (
      id, account_id, codigo, sku, nome, descricao, categoria_id, categoria, marca, fabricante_id, ean, ncm, preco,
      preco_promocional, icms_percentual, multiplo_venda, video_url, metadata, custo, estoque, unidade, ativo, tags, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
    ) RETURNING *`;
  },
  update() {
    return `UPDATE produtos SET
      codigo = $3,
      sku = $4,
      nome = $5,
      descricao = $6,
      categoria_id = $7,
      categoria = $8,
      marca = $9,
      fabricante_id = $10,
      ean = $11,
      ncm = $12,
      preco = $13,
      preco_promocional = $14,
      icms_percentual = $15,
      multiplo_venda = $16,
      video_url = $17,
      metadata = $18,
      custo = $19,
      estoque = $20,
      unidade = $21,
      ativo = $22,
      tags = $23,
      updated_at = $24
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  search() {
    return `SELECT * FROM produtos
      WHERE account_id = $1
        AND (nome ILIKE $2 OR sku ILIKE $3 OR codigo ILIKE $4 OR descricao ILIKE $5 OR marca ILIKE $6)
      ORDER BY created_at DESC
      LIMIT 100`;
  }
};
