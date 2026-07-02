export const IaMemoriasQueries = {
  countByWhere(whereSql) {
    return `SELECT COUNT(*)::int AS total FROM ia_memorias WHERE ${whereSql}`;
  },
  listByWhere(whereSql, limitPlaceholder, offsetPlaceholder) {
    return `SELECT * FROM ia_memorias WHERE ${whereSql} ORDER BY updated_at DESC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
  },
  getById() {
    return 'SELECT * FROM ia_memorias WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  insert() {
    return `INSERT INTO ia_memorias (
        id, account_id, tipo, titulo, conteudo, tags, prioridade, origem, modulo, status, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *`;
  },
  update(setSql) {
    return `UPDATE ia_memorias SET ${setSql} WHERE account_id = $1 AND id = $2 RETURNING *`;
  }
};
