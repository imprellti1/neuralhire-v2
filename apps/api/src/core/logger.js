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

function normalizeArgs(messageOrMeta, meta = {}) {
  if (messageOrMeta && typeof messageOrMeta === 'object' && !Array.isArray(messageOrMeta)) {
    return {
      message: messageOrMeta.message || 'log_event',
      meta: { ...messageOrMeta }
    };
  }

  return { message: messageOrMeta, meta };
}

export const logger = {
  info(message, meta = {}) {
    const normalized = normalizeArgs(message, meta);
    write('info', normalized.message, normalized.meta);
  },
  warn(message, meta = {}) {
    const normalized = normalizeArgs(message, meta);
    write('warn', normalized.message, normalized.meta);
  },
  error(message, meta = {}) {
    const normalized = normalizeArgs(message, meta);
    write('error', normalized.message, normalized.meta);
  },
  debug(message, meta = {}) {
    if (env.NODE_ENV === 'production') return;
    const normalized = normalizeArgs(message, meta);
    write('debug', normalized.message, normalized.meta);
  }
};
