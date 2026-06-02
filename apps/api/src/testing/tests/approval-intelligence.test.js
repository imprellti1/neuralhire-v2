import assert from 'node:assert/strict';
import { buildApprovalIntelligenceDashboard } from '../../modules/approval-intelligence/approval-intelligence.analytics.js';
import { getApprovalIntelligenceDashboardData } from '../../modules/approval-intelligence/approval-intelligence.repository.js';

export function getApprovalIntelligenceTests() {
  return [
    { name: 'summary and calculations', run: async () => {
      const rows = {
        drafts: [
          { id: 'd1', action_type: 'reactivation', created_at: '2026-06-01T10:00:00.000Z' },
          { id: 'd2', action_type: 'upsell', created_at: '2026-06-01T11:00:00.000Z' },
          { id: 'd3', action_type: 'upsell', created_at: '2026-06-01T12:00:00.000Z' }
        ],
        approvals: [
          { draft_id: 'd1', status: 'approved', created_at: '2026-06-01T10:10:00.000Z' },
          { draft_id: 'd2', status: 'rejected', created_at: '2026-06-01T11:12:00.000Z', comment: 'Cliente já atendido' }
        ],
        deliveryLogs: [{ draft_id: 'd1', created_at: '2026-06-01T10:25:00.000Z' }]
      };
      const data = buildApprovalIntelligenceDashboard(rows);
      assert.equal(data.summary.totalDrafts, 3);
      assert.equal(data.summary.approved, 1);
      assert.equal(data.summary.rejected, 1);
      assert.equal(data.actions.find((x) => x.type === 'reactivation').generated, 1);
      assert.equal(data.actions.find((x) => x.type === 'upsell').generated, 2);
      assert.equal(data.reasons[0].reason, 'Cliente já atendido');
      assert.equal(data.trends.length, 1);
    } },
    { name: 'tenant isolation contract', run: async () => {
      await assert.rejects(() => getApprovalIntelligenceDashboardData({ accountId: null }));
    } },
    { name: 'repository accepts injected rows', run: async () => {
      const data = await getApprovalIntelligenceDashboardData({ accountId: 'acc-a', rows: { drafts: [], approvals: [], deliveryLogs: [], actions: [] } });
      assert.equal(data.summary.totalDrafts, 0);
    } }
  ];
}

