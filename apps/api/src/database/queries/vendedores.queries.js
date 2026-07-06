export const VendedoresQueries = {
  list(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT * FROM vendedores WHERE account_id = $1${extraWhere} ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
  },
  count(whereSql = '') {
    const extraWhere = whereSql ? ` WHERE ${whereSql}` : '';
    return `SELECT COUNT(*)::int AS total FROM vendedores${extraWhere}`;
  },
  getById() {
    return 'SELECT * FROM vendedores WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  ping() {
    return 'SELECT 1 AS ok';
  },
  findByIdAnyAccount() {
    return 'SELECT id, account_id FROM vendedores WHERE id = $1 LIMIT 1';
  },
  findByUserId() {
    return 'SELECT * FROM vendedores WHERE account_id = $1 AND user_id = $2 LIMIT 1';
  },
  insert() {
    return `INSERT INTO vendedores (
      id, account_id, user_id, nome, email, telefone, status, observacoes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;
  },
  update() {
    return `UPDATE vendedores SET
      user_id = $3,
      nome = $4,
      email = $5,
      telefone = $6,
      status = $7,
      observacoes = $8,
      updated_at = $9
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  listFabricantesByVendedor() {
    return `SELECT
      vf.*,
      jsonb_build_object(
        'id', f.id,
        'account_id', f.account_id,
        'nome', f.nome,
        'razao_social', f.razao_social,
        'cnpj', f.cnpj,
        'status', f.status
      ) AS fabricantes
    FROM vendedor_fabricantes vf
    LEFT JOIN fabricantes f ON f.id = vf.fabricante_id AND f.account_id = vf.account_id
    WHERE vf.account_id = $1 AND vf.vendedor_id = $2
    ORDER BY vf.created_at DESC`;
  },
  listFabricantesByIds() {
    return 'SELECT id, account_id FROM fabricantes WHERE account_id = $1 AND id = ANY($2::uuid[])';
  },
  deleteFabricantesByVendedor() {
    return 'DELETE FROM vendedor_fabricantes WHERE account_id = $1 AND vendedor_id = $2';
  },
  insertFabricanteVinculos() {
    return `INSERT INTO vendedor_fabricantes (
      id, account_id, vendedor_id, fabricante_id, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
  }
};
