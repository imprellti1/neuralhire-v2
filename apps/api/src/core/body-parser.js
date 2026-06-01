import { ValidationError } from './errors.js';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

export async function parseJsonBody(req, { limitBytes = 1024 * 1024 } = {}) {
  const method = (req.method || 'GET').toUpperCase();
  if (!METHODS_WITH_BODY.has(method)) return null;

  const contentTypeRaw = String(req.headers?.['content-type'] || '').toLowerCase();
  if (contentTypeRaw && !contentTypeRaw.includes('application/json')) {
    throw new ValidationError('Content-Type nao suportado', {
      details: [{ field: 'content-type', message: 'Use application/json', rule: 'contentType' }],
      domain: 'core-platform',
      code: 'UNSUPPORTED_CONTENT_TYPE'
    });
  }

  const chunks = [];
  let total = 0;

  await new Promise((resolve, reject) => {
    let done = false;
    const fail = (error) => {
      if (done) return;
      done = true;
      reject(error);
    };
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        fail(new ValidationError('Payload excede limite permitido', {
          details: [{ field: 'body', message: 'Payload maior que 1MB', rule: 'maxBytes' }],
          domain: 'core-platform',
          code: 'PAYLOAD_TOO_LARGE'
        }));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', finish);
    req.on('aborted', () => fail(new ValidationError('Upload abortado', {
      details: [{ field: 'body', message: 'Stream abortada', rule: 'aborted' }],
      domain: 'core-platform',
      code: 'REQUEST_ABORTED'
    })));
    req.on('error', fail);
  });

  if (chunks.length === 0) return null;

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('JSON invalido', {
      details: [{ field: 'body', message: 'JSON malformado', rule: 'json' }],
      domain: 'core-platform',
      code: 'INVALID_JSON'
    });
  }
}
