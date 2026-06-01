import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

function parseBody(res) {
  try {
    return JSON.parse(res.body || '{}');
  } catch {
    return {};
  }
}

export function getValidationTests() {
  return [
    {
      name: 'POST /system/echo valido retorna ok true',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({
          method: 'POST',
          url: '/system/echo',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'teste' })
        });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 200, 'Status esperado 200');
        assertEqual(body.ok, true, 'ok esperado true');
      }
    },
    {
      name: 'POST /system/echo invalido retorna VALIDATION_ERROR',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({
          method: 'POST',
          url: '/system/echo',
          headers: { 'content-type': 'application/json' },
          body: '{}'
        });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 422, 'Status esperado 422');
        assertEqual(body.error.code, 'VALIDATION_ERROR', 'Code esperado VALIDATION_ERROR');
      }
    },
    {
      name: 'POST /system/echo com JSON invalido retorna INVALID_JSON',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({
          method: 'POST',
          url: '/system/echo',
          headers: { 'content-type': 'application/json' },
          body: '{"message":'
        });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 422, 'Status esperado 422');
        assertEqual(body.error.code, 'INVALID_JSON', 'Code esperado INVALID_JSON');
      }
    }
  ];
}
