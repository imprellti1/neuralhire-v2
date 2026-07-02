export class DatabaseError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'DatabaseError';
    this.code = options.code || null;
    this.sqlstate = options.sqlstate || null;
    this.details = options.details || null;
    this.hint = options.hint || null;
    this.cause = options.cause || null;
    this.sql = options.sql || null;
  }
}

export function isDatabaseError(error) {
  return error instanceof DatabaseError || error?.name === 'DatabaseError';
}
