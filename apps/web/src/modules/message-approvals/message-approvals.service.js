export async function listMessageApprovals(api) { return api.get('/message-approvals'); }
export async function listPendingMessageApprovals(api) { return api.get('/message-approvals/pending'); }
export async function getMessageApproval(api, approvalId) { return api.get(`/message-approvals/${approvalId}`); }
export async function approveMessageDraft(api, draftId, payload) { return api.post(`/message-approvals/${draftId}/approve`, payload); }
export async function rejectMessageDraft(api, draftId, payload) { return api.post(`/message-approvals/${draftId}/reject`, payload); }
