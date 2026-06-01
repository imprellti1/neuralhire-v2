import { env } from '../config/env.js';

function write(level, message, meta = {}) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export const logger = {
  info(message, meta = {}) {
    write('info', message, meta);
  },
  warn(message, meta = {}) {
    write('warn', message, meta);
  },
  error(message, meta = {}) {
    write('error', message, meta);
  },
  debug(message, meta = {}) {
    if (env.NODE_ENV === 'production') return;
    write('debug', message, meta);
  }
};
