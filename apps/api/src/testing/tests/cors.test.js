import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

export function getCorsTests() {
  return [
    {
      name: 'OPTIONS retorna 204',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'OPTIONS', url: '/clientes' });
        const res = createTestResponse();
        await app(req, res);
        assertEqual(res.statusCode, 204, 'Status esperado 204');
      }
    },
    {
      name: 'Access-Control-Allow-Origin existe',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'OPTIONS', url: '/clientes' });
        const res = createTestResponse();
        await app(req, res);
        assertEqual(Boolean(res.headers['access-control-allow-origin']), true, 'Header origin ausente');
      }
    },
    {
      name: 'Access-Control-Expose-Headers existe',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'OPTIONS', url: '/clientes' });
        const res = createTestResponse();
        await app(req, res);
        assertEqual(Boolean(res.headers['access-control-expose-headers']), true, 'Header expose ausente');
      }
    }
  ];
}
