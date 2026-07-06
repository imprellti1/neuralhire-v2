export const AiDirectorEventsQueries = {
  listEvents(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT * FROM ai_director_events WHERE account_id = $1${extraWhere} ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
  },
  getEventById() {
    return 'SELECT * FROM ai_director_events WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  insertEvent() {
    return `INSERT INTO ai_director_events (
      id, account_id, event_type, status, entity_type, entity_id, title, description, recurrence_count, metadata, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING *`;
  }
};
