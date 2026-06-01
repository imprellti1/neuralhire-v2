import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

export function getPayloadLimitTests() {
  return [
    {
      name: 'payload > 1MB retorna PAYLOAD_TOO_LARGE',
      run: async () => {
        const app = createApiApp();
        const big = 'a'.repeat((1024 * 1024) + 10);
        const req = createTestRequest({
          method: 'POST',
          url: '/system/echo',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: big })
        });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 413, 'Status esperado 413');
        assertEqual(body.error.code, 'PAYLOAD_TOO_LARGE', 'Code esperado PAYLOAD_TOO_LARGE');
      }
    },
    {
      name: 'content-type invalido retorna UNSUPPORTED_CONTENT_TYPE',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({
          method: 'POST',
          url: '/system/echo',
          headers: { 'content-type': 'text/plain' },
          body: 'abc'
        });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 422, 'Status esperado 422');
        assertEqual(body.error.code, 'UNSUPPORTED_CONTENT_TYPE', 'Code esperado UNSUPPORTED_CONTENT_TYPE');
      }
    }
  ];
}
