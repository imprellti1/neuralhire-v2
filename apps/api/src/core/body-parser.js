import { ValidationError } from './errors.js';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

function parseContentType(contentTypeRaw = '') {
  const [type = '', ...params] = String(contentTypeRaw).split(';').map((part) => part.trim()).filter(Boolean);
  const extras = {};
  for (const param of params) {
    const [key, value] = param.split('=').map((part) => part.trim());
    if (key) extras[key.toLowerCase()] = value?.replace(/^"|"$/g, '') || '';
  }
  return { type: type.toLowerCase(), boundary: extras.boundary || null };
}

async function readRequestBuffer(req, limitBytes) {
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
          details: [{ field: 'body', message: 'Payload maior que 2MB', rule: 'maxBytes' }],
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

  return Buffer.concat(chunks);
}

function parseMultipartBody(buffer, boundary) {
  const marker = `--${boundary}`;
  const text = buffer.toString('binary');
  const parts = text.split(marker);
  const payload = {};

  for (const part of parts) {
    if (!part) continue;
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n--$/, '');
    if (!trimmed.trim() || trimmed.trim() === '--') continue;
    const separator = trimmed.indexOf('\r\n\r\n');
    if (separator < 0) continue;
    const rawHeaders = trimmed.slice(0, separator).split('\r\n');
    const rawValue = trimmed.slice(separator + 4).replace(/\r\n$/, '');
    const headers = {};
    for (const line of rawHeaders) {
      const [name, ...rest] = line.split(':');
      if (!name || !rest.length) continue;
      headers[name.toLowerCase()] = rest.join(':').trim();
    }
    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const fileNameMatch = disposition.match(/filename="([^"]*)"/i);
    const contentType = String(headers['content-type'] || '').toLowerCase();
    if (fileNameMatch) {
      const fileBuffer = Buffer.from(rawValue, 'binary');
      payload[fieldName] = {
        fileName: fileNameMatch[1],
        mimeType: contentType || 'application/octet-stream',
        size: fileBuffer.length,
        base64: fileBuffer.toString('base64')
      };
      continue;
    }
    payload[fieldName] = Buffer.from(rawValue, 'binary').toString('utf8').replace(/\r\n$/, '');
  }

  return payload;
}

export async function parseJsonBody(req, { limitBytes = 1024 * 1024 } = {}) {
  const method = (req.method || 'GET').toUpperCase();
  if (!METHODS_WITH_BODY.has(method)) return null;

  const contentTypeRaw = String(req.headers?.['content-type'] || '').toLowerCase();
  const { type, boundary } = parseContentType(contentTypeRaw);
  const effectiveLimitBytes = type.includes('multipart/form-data') ? 2 * 1024 * 1024 : limitBytes;
  if (!type) {
    const buffer = await readRequestBuffer(req, effectiveLimitBytes);
    if (!buffer.length) return null;
    const raw = buffer.toString('utf8').trim();
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
  if (contentTypeRaw && !type.includes('application/json') && !type.includes('multipart/form-data')) {
    throw new ValidationError('Content-Type nao suportado', {
      details: [{ field: 'content-type', message: 'Use application/json ou multipart/form-data', rule: 'contentType' }],
      domain: 'core-platform',
      code: 'UNSUPPORTED_CONTENT_TYPE'
    });
  }

  const buffer = await readRequestBuffer(req, effectiveLimitBytes);
  if (!buffer.length) return null;

  if (type.includes('multipart/form-data')) {
    if (!boundary) {
      throw new ValidationError('Boundary ausente no multipart/form-data', {
        details: [{ field: 'content-type', message: 'Boundary obrigatoria', rule: 'boundary' }],
        domain: 'core-platform',
        code: 'INVALID_MULTIPART'
      });
    }
    return parseMultipartBody(buffer, boundary);
  }

  const raw = buffer.toString('utf8').trim();
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
