import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { getApprovalIntelligenceDashboardData } from './approval-intelligence.repository.js';

function periodFromQuery(query = {}) {
  const period = String(query.period || 'day').toLowerCase();
  return ['day', 'week', 'month'].includes(period) ? period : 'day';
}

export async function getApprovalIntelligenceDashboardHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const data = await getApprovalIntelligenceDashboardData({ accountId, period: periodFromQuery(context.query || {}) });
  return { ok: true, ...data };
}

export async function getApprovalIntelligenceTrendsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const data = await getApprovalIntelligenceDashboardData({ accountId, period: periodFromQuery(context.query || {}) });
  return { ok: true, items: data.trends };
}

export async function getApprovalIntelligenceReasonsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const data = await getApprovalIntelligenceDashboardData({ accountId, period: periodFromQuery(context.query || {}) });
  return { ok: true, items: data.reasons };
}

export async function getApprovalIntelligenceActionsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const data = await getApprovalIntelligenceDashboardData({ accountId, period: periodFromQuery(context.query || {}) });
  return { ok: true, items: data.actions };
}

