export const AiDirectorActionPlansQueries = {
  listActionPlans(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT * FROM ai_director_action_plans WHERE account_id = $1${extraWhere} ORDER BY criado_em DESC LIMIT $2 OFFSET 0`;
  },
  listOpenActionPlansByAccount() {
    return 'SELECT * FROM ai_director_action_plans WHERE account_id = $1 AND status = \'aberto\' ORDER BY criado_em DESC LIMIT $2 OFFSET 0';
  },
  getActionPlanById() {
    return 'SELECT * FROM ai_director_action_plans WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  insertActionPlan() {
    return `INSERT INTO ai_director_action_plans (
      id, account_id, executive_memory_id, titulo, descricao, gerente_responsavel, impacto, esforco, prioridade_score, prazo_dias, status, metadata, criado_em, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    ) RETURNING *`;
  },
  updateActionPlanById() {
    return `UPDATE ai_director_action_plans SET
      executive_memory_id = $3,
      titulo = $4,
      descricao = $5,
      gerente_responsavel = $6,
      impacto = $7,
      esforco = $8,
      prioridade_score = $9,
      prazo_dias = $10,
      status = $11,
      metadata = $12,
      updated_at = $13
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  updateActionPlanStatus() {
    return `UPDATE ai_director_action_plans SET
      status = $3,
      updated_at = $4
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  }
};
