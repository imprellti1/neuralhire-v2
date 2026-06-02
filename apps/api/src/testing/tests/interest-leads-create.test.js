import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryInterestLeadsForTests } from '../../modules/interest-leads/interest-leads.repository.js';

export function getInterestLeadsCreateTests() {
  return [{
    name: 'POST /interest-leads cria lead',
    run: async () => {
      __resetMemoryInterestLeadsForTests();
      const app = createApiApp();
      const req = createTestRequest({ method: 'POST', url: '/interest-leads', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Ana', empresa: 'Acme', email: 'ana@acme.com' }) });
      const res = createTestResponse();
      await app(req, res);
      const body = JSON.parse(res.body);
      assertEqual(res.statusCode, 200);
      assertEqual(body.ok, true);
    }
  }];
}


