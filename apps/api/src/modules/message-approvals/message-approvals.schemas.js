export function normalizeApprovalCommentPayload(payload = {}) {
  return { comment: String(payload.comment || '').trim() };
}
