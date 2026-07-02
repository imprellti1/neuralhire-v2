export const CustomerMemoryQueries = {
  getById() {
    return 'SELECT * FROM customer_memories WHERE account_id = $1 AND cliente_id = $2 LIMIT 1';
  },
  insert() {
    return `INSERT INTO customer_memories (
            id, account_id, cliente_id, memory, risk_score, potential_score, last_rebuilt_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
  },
  update() {
    return `UPDATE customer_memories
         SET memory = $3, risk_score = $4, potential_score = $5, last_rebuilt_at = $6, updated_at = $7
         WHERE account_id = $1 AND cliente_id = $2
         RETURNING *`;
  },
  countByWhere(whereSql) {
    return `SELECT COUNT(*)::int AS total FROM customer_memories ${whereSql}`;
  },
  listByWhere(whereSql, orderSql, limitPlaceholder, offsetPlaceholder) {
    return `SELECT * FROM customer_memories ${whereSql} ${orderSql} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
  },
  deleteById() {
    return 'DELETE FROM customer_memories WHERE account_id = $1 AND cliente_id = $2 RETURNING *';
  }
};
