export const AiDirectorObservationsQueries = {
  listObservations() {
    return 'SELECT * FROM ai_director_observations WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3';
  },
  listObservationsByFilters(filterSql = '') {
    const whereSql = filterSql ? ` AND ${filterSql}` : '';
    return `SELECT * FROM ai_director_observations WHERE account_id = $1${whereSql} ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
  },
  getObservationById() {
    return 'SELECT * FROM ai_director_observations WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  getObservationByEquivalentKey() {
    return `SELECT * FROM ai_director_observations
      WHERE account_id = $1
        AND manager_id = $2
        AND category = $3
        AND title = $4
        AND status = $5
        AND origin = $6
      ORDER BY updated_at DESC
      LIMIT 10`;
  },
  insertObservation() {
    return `INSERT INTO ai_director_observations (
      id, account_id, manager_id, manager_name, category, title, description, severity,
      impact_score, urgency_score, status, source_type, source_id, metadata, origin, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17
    ) RETURNING *`;
  },
  updateObservationById() {
    return `UPDATE ai_director_observations SET
      status = $3,
      metadata = $4,
      updated_at = $5
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  deleteObservationsByIds() {
    return 'DELETE FROM ai_director_observations WHERE id = ANY($1)';
  }
};
