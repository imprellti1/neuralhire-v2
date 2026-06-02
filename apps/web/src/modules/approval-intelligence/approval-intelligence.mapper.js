export function mapApprovalIntelligenceResponse(payload = {}) {
  return {
    summary: payload.summary || { totalDrafts: 0, approved: 0, rejected: 0, approvalRate: 0, rejectionRate: 0, avgApprovalTime: 0, avgSendTime: 0 },
    actions: payload.actions || payload.items || [],
    reasons: payload.reasons || payload.reasonItems || [],
    trends: payload.trends || payload.trendItems || []
  };
}
