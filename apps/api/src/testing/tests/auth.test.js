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

export function getAuthTests() {
  return [
    {
      name: 'rota protegida sem token retorna 401',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'GET', url: '/system/protected' });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(res.statusCode, 401, 'Status esperado 401');
        assertEqual(body.error.code, 'AUTH_REQUIRED', 'Code esperado AUTH_REQUIRED');
      }
    },
    {
      name: 'auth-context sem token retorna authenticated false',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'GET', url: '/system/auth-context' });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(body.auth.authenticated, false, 'authenticated deve ser false');
        assertEqual(body.auth.tokenPresent, false, 'tokenPresent deve ser false');
      }
    },
    {
      name: 'token invalido marca tokenPresent true',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({
          method: 'GET',
          url: '/system/auth-context',
          headers: { authorization: 'Bearer token_invalido' }
        });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(body.auth.tokenPresent, true, 'tokenPresent deve ser true');
      }
    },
    {
      name: 'protected sem auth retorna AUTH_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const req = createTestRequest({ method: 'GET', url: '/system/protected' });
        const res = createTestResponse();
        await app(req, res);
        const body = parseBody(res);
        assertEqual(body.error.code, 'AUTH_REQUIRED', 'Code esperado AUTH_REQUIRED');
      }
    }
  ];
}
