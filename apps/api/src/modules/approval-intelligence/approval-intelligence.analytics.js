const ACTION_TYPES = ['reactivation', 'replenishment', 'upsell', 'cross_sell', 'relationship', 'risk_recovery'];

function normalizeType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ACTION_TYPES.includes(type) ? type : 'relationship';
}

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bucketDate(date, period = 'day') {
  const d = toDate(date);
  if (!d) return null;
  if (period === 'month') return d.toISOString().slice(0, 7);
  if (period === 'week') {
    const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() - day + 1);
    return copy.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function listSortedByCount(entries) {
  return [...entries.entries()].sort((a, b) => b[1] - a[1]);
}

function approvalDurationMs(draft, approval) {
  const created = toDate(draft?.created_at || draft?.createdAt);
  const decided = toDate(approval?.created_at || approval?.createdAt || approval?.approved_at || approval?.rejected_at);
  if (!created || !decided) return 0;
  return Math.max(0, decided.getTime() - created.getTime());
}

export function buildApprovalIntelligenceDashboard({ drafts = [], approvals = [], deliveryLogs = [], actions = [], period = 'day' } = {}) {
  const draftsById = new Map(drafts.map((draft) => [draft.id, draft]));
  const approvalsByDraftId = new Map(approvals.map((approval) => [approval.draft_id || approval.draftId, approval]));
  const totalDrafts = drafts.length;
  const approved = approvals.filter((item) => String(item.status || '').toLowerCase() === 'approved').length;
  const rejected = approvals.filter((item) => String(item.status || '').toLowerCase() === 'rejected').length;
  const approvalRate = totalDrafts > 0 ? (approved / totalDrafts) * 100 : 0;
  const rejectionRate = totalDrafts > 0 ? (rejected / totalDrafts) * 100 : 0;

  const approvalDurations = approvals
    .filter((item) => String(item.status || '').toLowerCase() === 'approved')
    .map((approval) => approvalDurationMs(draftsById.get(approval.draft_id || approval.draftId), approval))
    .filter((value) => value > 0);
  const sendDurations = deliveryLogs
    .map((log) => {
      const draft = draftsById.get(log.draft_id || log.draftId);
      return approvalDurationMs(draft, log);
    })
    .filter((value) => value > 0);

  const actionsMap = new Map(ACTION_TYPES.map((type) => [type, { type, generated: 0, approved: 0, rejected: 0 }]));
  for (const draft of drafts) {
    const type = normalizeType(draft.action_type || draft.actionType || draft.draft_type || draft.draftType);
    actionsMap.get(type).generated += 1;
  }
  for (const approval of approvals) {
    const draft = draftsById.get(approval.draft_id || approval.draftId);
    const type = normalizeType(draft?.action_type || draft?.actionType || draft?.draft_type || draft?.draftType);
    if (String(approval.status || '').toLowerCase() === 'approved') actionsMap.get(type).approved += 1;
    if (String(approval.status || '').toLowerCase() === 'rejected') actionsMap.get(type).rejected += 1;
  }

  const rejectionReasons = new Map();
  for (const approval of approvals) {
    if (String(approval.status || '').toLowerCase() !== 'rejected') continue;
    const reason = String(approval.reason || approval.comment || approval.rejection_reason || 'Sem motivo informado').trim() || 'Sem motivo informado';
    rejectionReasons.set(reason, (rejectionReasons.get(reason) || 0) + 1);
  }

  const trends = new Map();
  for (const approval of approvals) {
    const date = bucketDate(approval.created_at || approval.createdAt || approval.approved_at || approval.rejected_at, period);
    if (!date) continue;
    const current = trends.get(date) || { date, generated: 0, approved: 0, rejected: 0 };
    current.generated += 1;
    if (String(approval.status || '').toLowerCase() === 'approved') current.approved += 1;
    if (String(approval.status || '').toLowerCase() === 'rejected') current.rejected += 1;
    trends.set(date, current);
  }

  return {
    summary: {
      totalDrafts,
      approved,
      rejected,
      approvalRate,
      rejectionRate,
      avgApprovalTime: approvalDurations.length ? approvalDurations.reduce((a, b) => a + b, 0) / approvalDurations.length : 0,
      avgSendTime: sendDurations.length ? sendDurations.reduce((a, b) => a + b, 0) / sendDurations.length : 0
    },
    actions: [...actionsMap.values()].sort((a, b) => b.generated - a.generated),
    reasons: listSortedByCount(rejectionReasons).map((entry) => ({ reason: entry[0], count: entry[1] })),
    trends: [...trends.values()].sort((a, b) => a.date.localeCompare(b.date))
  };
}
