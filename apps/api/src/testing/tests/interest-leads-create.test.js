import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { env } from '../../config/env.js';
import { __resetMemoryInterestLeadsForTests } from '../../modules/interest-leads/interest-leads.repository.js';

export function getInterestLeadsCreateTests() {
  const publicInterestAccountId = 'acc-interest-public';
  return [{
    name: 'POST /interest-leads cria lead com conta publica configurada',
    run: async () => {
      __resetMemoryInterestLeadsForTests();
      const previous = { publicInterest: env.PUBLIC_INTEREST_ACCOUNT_ID, interestLeads: env.INTEREST_LEADS_ACCOUNT_ID };
      env.PUBLIC_INTEREST_ACCOUNT_ID = publicInterestAccountId;
      env.INTEREST_LEADS_ACCOUNT_ID = '';
      const app = createApiApp();
      try {
        const req = createTestRequest({ method: 'POST', url: '/interest-leads', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Ana', empresa: 'Acme', email: 'ana@acme.com' }) });
        const res = createTestResponse();
        await app(req, res);
        const body = JSON.parse(res.body);
        assertEqual(res.statusCode, 200);
        assertEqual(body.ok, true);
        assertEqual(body.item.account_id, publicInterestAccountId);
      } finally {
        env.PUBLIC_INTEREST_ACCOUNT_ID = previous.publicInterest;
        env.INTEREST_LEADS_ACCOUNT_ID = previous.interestLeads;
      }
    }
  }];
}


