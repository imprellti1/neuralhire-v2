import { randomUUID } from 'node:crypto';
import { parseQueryParams } from './query-params.js';

export function createRequestContext(req) {
  return {
    requestId: randomUUID(),
    method: req.method || 'GET',
    url: req.url || '/',
    query: parseQueryParams(req.url || '/'),
    startedAt: Date.now(),
    ip: req.socket?.remoteAddress || null,
    userAgent: req.headers?.['user-agent'] || null
  };
}