import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { env } from '../../config/env.js';
import { __resetMemoryInterestLeadsForTests } from '../../modules/interest-leads/interest-leads.repository.js';

export function getInterestLeadsStatusTests() {
  return [{
    name: 'PATCH /interest-leads/:id/status atualiza',
    run: async () => {
      __resetMemoryInterestLeadsForTests();
      const previous = {
        publicInterest: env.PUBLIC_INTEREST_ACCOUNT_ID,
        interestLeads: env.INTEREST_LEADS_ACCOUNT_ID
      };
      env.PUBLIC_INTEREST_ACCOUNT_ID = 'acc-interest-public';
      env.INTEREST_LEADS_ACCOUNT_ID = '';
      try {
        const app = createApiApp();
        const createReq = createTestRequest({
          method: 'POST',
          url: '/interest-leads',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nome: 'Ana', empresa: 'Acme', email: 'ana@acme.com' })
        });
        const createRes = createTestResponse();
        await app(createReq, createRes);
        const created = JSON.parse(createRes.body).item;
        const req = createTestRequest({
          method: 'PATCH',
          url: `/interest-leads/${created.id}/status`,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'contatado' })
        });
        const res = createTestResponse();
        await app(req, res);
        const body = JSON.parse(res.body);
        assertEqual(res.statusCode, 200);
        assertEqual(body.item.status, 'contatado');
      } finally {
        env.PUBLIC_INTEREST_ACCOUNT_ID = previous.publicInterest;
        env.INTEREST_LEADS_ACCOUNT_ID = previous.interestLeads;
      }
    }
  }];
}

