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

export function getPublicRouteTests() {
  return [
    {
      name: '/health publico responde ok true',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'GET', url: '/health' });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 200, 'Status esperado 200');
        assertEqual(body.ok, true, 'ok esperado true');
      }
    },
    {
      name: '/system/info publico responde ok true',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'GET', url: '/system/info' });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 200, 'Status esperado 200');
        assertEqual(body.ok, true, 'ok esperado true');
      }
    },
    {
      name: 'rota inexistente retorna NOT_FOUND',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'GET', url: '/nao-existe' });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 404, 'Status esperado 404');
        assertEqual(body.error.code, 'NOT_FOUND', 'Code esperado NOT_FOUND');
      }
    }
  ];
}
