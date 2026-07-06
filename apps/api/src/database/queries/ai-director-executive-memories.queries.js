export const AiDirectorExecutiveMemoriesQueries = {
  listMemories(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT * FROM ai_director_executive_memories WHERE account_id = $1${extraWhere} ORDER BY criado_em DESC LIMIT $2 OFFSET $3`;
  },
  findByLogicalKey() {
    return `SELECT * FROM ai_director_executive_memories
      WHERE account_id = $1
        AND tipo = $2
        AND categoria = $3
        AND lower(titulo) = lower($4)
        AND origem = $5
      ORDER BY criado_em DESC
      LIMIT 10`;
  },
  insertMemory() {
    return `INSERT INTO ai_director_executive_memories (
      id, account_id, tipo, titulo, descricao, categoria, severidade, metadata, origem, criado_em, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) RETURNING *`;
  },
  updateMemory() {
    return `UPDATE ai_director_executive_memories SET
      tipo = $3,
      titulo = $4,
      descricao = $5,
      categoria = $6,
      severidade = $7,
      metadata = $8,
      origem = $9,
      criado_em = $10,
      updated_at = $11
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  }
};
