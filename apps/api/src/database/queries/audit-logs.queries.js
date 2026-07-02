export const AuditLogsQueries = {
  countByWhere(whereSql) {
    return `SELECT COUNT(*)::int AS total FROM system_audit_logs WHERE ${whereSql}`;
  },
  listByWhere(whereSql, limitPlaceholder, offsetPlaceholder) {
    return `SELECT * FROM system_audit_logs WHERE ${whereSql} ORDER BY created_at DESC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
  },
  getById() {
    return 'SELECT * FROM system_audit_logs WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  insert() {
    return `INSERT INTO system_audit_logs (
      id, account_id, modulo, entidade, entidade_id, acao, descricao, status,
      user_id, user_email, user_nome, erro_codigo, erro_mensagem, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14
    ) RETURNING *`;
  }
};
