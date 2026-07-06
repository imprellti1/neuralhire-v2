export const ProdutoCategoriasQueries = {
  ping() {
    return 'SELECT 1 AS ok';
  },
  list() {
    return `SELECT * FROM produto_categorias
      WHERE account_id = $1
      ORDER BY parent_id ASC NULLS FIRST, nome ASC, created_at DESC`;
  },
  getById() {
    return 'SELECT * FROM produto_categorias WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  getBySlug() {
    return 'SELECT * FROM produto_categorias WHERE account_id = $1 AND slug = $2 LIMIT 1';
  },
  insert() {
    return `INSERT INTO produto_categorias (
      id, account_id, parent_id, nome, slug, descricao, status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    ) RETURNING *`;
  },
  update() {
    return `UPDATE produto_categorias SET
      parent_id = $3,
      nome = $4,
      slug = $5,
      descricao = $6,
      status = $7,
      updated_at = $8
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  }
};
