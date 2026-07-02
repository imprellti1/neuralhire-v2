import { DatabaseError } from './database.errors.js';

export async function runTransaction(pool, callback, helpers) {
  const client = await pool.connect();
  const tx = helpers.createTransactionClient(client);

  try {
    await client.query('BEGIN');
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors so original failure is preserved
    }
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw helpers.normalizeError(error);
  } finally {
    client.release();
  }
}

