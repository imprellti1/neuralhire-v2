import { INTERNAL_SERVER_ERROR } from './http-status.js';
import { AppError } from './errors.js';

export function sendJson(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  if (statusCode === 204) {
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function sendSuccess(res, payload = {}, statusCode = 200) {
  return sendJson(res, statusCode, {
    ok: true,
    ...payload
  });
}

export function sendError(res, error, requestContext = null) {
  const normalized = error instanceof AppError
    ? error
    : new AppError('Erro interno do servidor', {
      statusCode: INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      domain: 'core-platform',
      details: null,
      expose: false
    });

  const message = normalized.expose ? normalized.message : 'Erro interno do servidor';
  const requestId = requestContext?.requestId || null;

  return sendJson(res, normalized.statusCode, {
    ok: false,
    error: {
      code: normalized.code,
      message,
      domain: normalized.domain,
      details: normalized.details,
      requestId
    }
  }, requestId ? { 'X-Request-Id': requestId } : {});
}
