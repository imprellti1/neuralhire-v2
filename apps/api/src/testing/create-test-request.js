import { Readable } from 'node:stream';

export function createTestRequest({ method = 'GET', url = '/', headers = {}, body = null }) {
  const payload = body === null || body === undefined ? '' : String(body);
  const stream = new Readable({ read() {} });
  if (payload) stream.push(payload);
  stream.push(null);

  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  stream.socket = { remoteAddress: '127.0.0.1' };

  return stream;
}
