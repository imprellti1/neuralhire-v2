import { ValidationError } from '../../core/errors.js';
import { approveDraft, createApproval, getApprovalById, getApprovalByDraftId, listApprovals, listPendingApprovals, rejectDraft } from './message-approvals.repository.js';

function assertApprover(context = {}) {
  const role = String(context.auth?.role || '');
  if (!['manager', 'admin', 'super_admin'].includes(role)) {
    throw new ValidationError('Role sem permissao', { domain: 'message-approvals' });
  }
  return role;
}

export async function listPendingMessageApprovalsHandler(context = {}) {
  return { ok: true, items: await listPendingApprovals({ accountId: context.accountId }) };
}

export async function listMessageApprovalsHandler(context = {}) {
  return { ok: true, items: await listApprovals({ accountId: context.accountId }) };
}

export async function getMessageApprovalHandler(context = {}) {
  return { ok: true, item: await getApprovalById(String(context.params?.approvalId || '').trim(), { accountId: context.accountId }) };
}

export async function approveMessageDraftHandler(context = {}) {
  assertApprover(context);
  const draftId = String(context.params?.draftId || '').trim();
  return { ok: true, item: await approveDraft(draftId, { accountId: context.accountId, reviewerId: context.auth?.userId || null, reviewerName: context.auth?.name || context.auth?.email || context.auth?.role || null, comment: context.body?.comment || '' }) };
}

export async function rejectMessageDraftHandler(context = {}) {
  assertApprover(context);
  const draftId = String(context.params?.draftId || '').trim();
  const comment = String(context.body?.comment || '').trim();
  if (!comment) throw new ValidationError('comment obrigatorio', { domain: 'message-approvals' });
  return { ok: true, item: await rejectDraft(draftId, { accountId: context.accountId, reviewerId: context.auth?.userId || null, reviewerName: context.auth?.name || context.auth?.email || context.auth?.role || null, comment }) };
}

export async function createMessageApprovalHandler(context = {}) {
  return { ok: true, item: await createApproval({ draftId: String(context.body?.draftId || '').trim() }, { accountId: context.accountId }) };
}

export async function getMessageApprovalByDraftHandler(context = {}) {
  const draftId = String(context.params?.draftId || '').trim();
  return { ok: true, item: await getApprovalByDraftId(draftId, { accountId: context.accountId }) };
}
