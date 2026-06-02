import test from 'node:test';
import assert from 'node:assert/strict';
import { renderApprovalIntelligencePage } from './approval-intelligence.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('approval intelligence page renders states and analytics', async () => {
  const dom = setupFrontendDom('#/x');
  let calls = 0;
  const apiClient = { get: async () => {
    calls += 1;
    if (calls === 1) throw new Error('fail');
    return { summary: { totalDrafts: 3, approvalRate: 90, rejectionRate: 10, avgApprovalTime: 600000, avgSendTime: 120000 }, actions: [{ type: 'reactivation', generated: 10, approved: 9, rejected: 1 }], reasons: [{ reason: 'Cliente já atendido', count: 2 }], trends: [{ date: '2026-06-01', approved: 1, rejected: 1 }] };
  } };
  await renderApprovalIntelligencePage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Erro ao carregar/i);
  document.querySelector('#ai-retry').click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Approval Intelligence/i);
  assert.match(document.body.textContent, /Total Drafts/i);
  assert.match(document.body.textContent, /Cliente já atendido/i);
  teardownFrontendDom(dom);
});

