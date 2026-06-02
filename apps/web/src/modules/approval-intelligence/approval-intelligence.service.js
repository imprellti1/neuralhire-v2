export async function getApprovalIntelligenceDashboard(api, period = 'day') { return api.get(`/approval-intelligence/dashboard?period=${encodeURIComponent(period)}`); }
export async function getApprovalIntelligenceActions(api, period = 'day') { return api.get(`/approval-intelligence/actions?period=${encodeURIComponent(period)}`); }
export async function getApprovalIntelligenceReasons(api, period = 'day') { return api.get(`/approval-intelligence/reasons?period=${encodeURIComponent(period)}`); }
export async function getApprovalIntelligenceTrends(api, period = 'day') { return api.get(`/approval-intelligence/trends?period=${encodeURIComponent(period)}`); }

