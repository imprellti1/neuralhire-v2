import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

const endpoints = ['/analytics/summary', '/analytics/products', '/analytics/customers', '/analytics/timeline'];

const parse = (r) => { try { return JSON.parse(r.body || '{}'); } catch { return {}; } };
async function call(app, method, url, role = 'manager', accountId = 'acc-date-val', body) {
  const headers = { 'x-test-role': role, 'x-test-account-id': accountId };
  if (body) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parse(res) };
}

function expectBadRequestWithCode(response, code, message) {
  assertEqual(response.res.statusCode, 422);
  assertEqual(response.body?.error?.code, code);
  assertEqual(response.body?.error?.message, message);
}

export function getAnalyticsDateValidationTests() {
  return [
    {
      name: 'analytics aceita ausencia de datas em todos endpoints',
      run: async () => {
        const app = createApiApp();
        for (const endpoint of endpoints) {
          const out = await call(app, 'GET', endpoint);
          assertEqual(out.res.statusCode, 200);
        }
      }
    },
    {
      name: 'analytics aceita startDate valido em todos endpoints',
      run: async () => {
        const app = createApiApp();
        for (const endpoint of endpoints) {
          const out = await call(app, 'GET', `${endpoint}?startDate=2026-05-01`);
          assertEqual(out.res.statusCode, 200);
        }
      }
    },
    {
      name: 'analytics aceita endDate valido em todos endpoints',
      run: async () => {
        const app = createApiApp();
        for (const endpoint of endpoints) {
          const out = await call(app, 'GET', `${endpoint}?endDate=2026-05-31`);
          assertEqual(out.res.statusCode, 200);
        }
      }
    },
    {
      name: 'analytics rejeita startDate invalido em todos endpoints',
      run: async () => {
        const app = createApiApp();
        for (const endpoint of endpoints) {
          const out = await call(app, 'GET', `${endpoint}?startDate=2026-5-1`);
          expectBadRequestWithCode(out, 'INVALID_DATE', 'Invalid date format. Use YYYY-MM-DD.');
        }
      }
    },
    {
      name: 'analytics rejeita endDate invalido em todos endpoints',
      run: async () => {
        const app = createApiApp();
        for (const endpoint of endpoints) {
          const out = await call(app, 'GET', `${endpoint}?endDate=31-05-2026`);
          expectBadRequestWithCode(out, 'INVALID_DATE', 'Invalid date format. Use YYYY-MM-DD.');
        }
      }
    },
    {
      name: 'analytics rejeita intervalo com startDate maior que endDate em todos endpoints',
      run: async () => {
        const app = createApiApp();
        for (const endpoint of endpoints) {
          const out = await call(app, 'GET', `${endpoint}?startDate=2026-05-31&endDate=2026-05-01`);
          expectBadRequestWithCode(out, 'INVALID_DATE_RANGE', 'startDate must be less than or equal to endDate.');
        }
      }
    }
  ];
}
