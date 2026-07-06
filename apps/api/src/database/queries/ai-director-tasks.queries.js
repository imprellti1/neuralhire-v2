export const AiDirectorTasksQueries = {
  listTasks(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT * FROM ai_director_tasks WHERE account_id = $1${extraWhere} ORDER BY updated_at DESC LIMIT $2 OFFSET $3`;
  },
  listOpenTasksByActionPlan() {
    return `SELECT * FROM ai_director_tasks WHERE account_id = $1 AND action_plan_id = $2 AND status IN ('open', 'in_progress') ORDER BY updated_at DESC LIMIT $3 OFFSET 0`;
  },
  listOpenTasksByAccount() {
    return `SELECT * FROM ai_director_tasks WHERE account_id = $1 AND status IN ('open', 'in_progress') ORDER BY updated_at DESC LIMIT $2 OFFSET 0`;
  },
  listOpenSellerTasksByAccount() {
    return `SELECT * FROM ai_director_tasks WHERE account_id = $1 AND cliente_id = $2 AND vendedor_id = $3 AND status = 'open' ORDER BY updated_at DESC LIMIT $4 OFFSET 0`;
  },
  getTaskById() {
    return 'SELECT * FROM ai_director_tasks WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  insertTask() {
    return `INSERT INTO ai_director_tasks (
      id, account_id, action_plan_id, manager_id, manager_name, gerente, cliente_id, vendedor_id, vendedor_name,
      delegation_level, delegation_reason, category, title, titulo, description, descricao, priority, prioridade,
      status, financial_amount, valor, amount, value, impacto_estimado, monetary_value, due_at, completed_at,
      percentual_conclusao, origin, metadata, criado_em, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25, $26,
      $27, $28, $29, $30, $31, $32
    ) RETURNING *`;
  },
  updateTaskById() {
    return `UPDATE ai_director_tasks SET
      action_plan_id = $3,
      manager_id = $4,
      manager_name = $5,
      gerente = $6,
      cliente_id = $7,
      vendedor_id = $8,
      vendedor_name = $9,
      delegation_level = $10,
      delegation_reason = $11,
      category = $12,
      title = $13,
      titulo = $14,
      description = $15,
      descricao = $16,
      priority = $17,
      prioridade = $18,
      status = $19,
      financial_amount = $20,
      valor = $21,
      amount = $22,
      value = $23,
      impacto_estimado = $24,
      monetary_value = $25,
      due_at = $26,
      completed_at = $27,
      percentual_conclusao = $28,
      origin = $29,
      metadata = $30,
      updated_at = $31
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  updateTaskStatus() {
    return `UPDATE ai_director_tasks SET
      status = $3,
      percentual_conclusao = $4,
      completed_at = $5,
      updated_at = $6
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  }
};
