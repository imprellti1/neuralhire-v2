import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { isSupabaseConfigured } from '../../database/supabase.client.js';
import { __getMutableMessageDraftById, getMessageDraftById } from '../message-drafts/message-drafts.repository.js';
import { addEvent, getConversationById } from '../whatsapp-conversations/whatsapp-conversations.repository.js';

const approvals = [];

function now() { return new Date().toISOString(); }
function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'message-approvals' });
}
function assertNoForbiddenFields(data = {}) {
  for (const key of Object.keys(data)) {
    if (['account_id', 'accountId', 'tenant_id', 'tenantId', 'reviewer_id', 'reviewerId'].includes(key)) {
      throw new ValidationError(`Campo nao permitido: ${key}`);
    }
  }
}
function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }

async function resolveDraft(draftId, accountId) {
  const draft = await getMessageDraftById(draftId, { accountId });
  if (!draft) throw new NotFoundError('Draft nao encontrado', { code: 'MESSAGE_DRAFT_NOT_FOUND', domain: 'message-approvals' });
  return draft;
}

function shapeApproval(item) {
  return { ...item };
}

export function getMessageApprovalsRepositoryMode() { return { mode: mode(), supabaseConfigured: isSupabaseConfigured() }; }

export async function createApproval(data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  assertNoForbiddenFields(data);
  const draft = await resolveDraft(String(data.draftId || '').trim(), accountId);
  const item = {
    id: randomUUID(),
    account_id: accountId,
    draft_id: draft.id,
    conversation_id: draft.conversation_id || null,
    cliente_id: draft.cliente_id || null,
    status: String(data.status || 'pending'),
    reviewer_id: null,
    reviewer_name: null,
    comment: String(data.comment || '').trim() || null,
    created_at: now(),
    updated_at: now()
  };
  approvals.push(item);
  return shapeApproval(item);
}

export async function getApprovalById(approvalId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const item = approvals.find((row) => row.id === approvalId && row.account_id === accountId);
  if (!item) throw new NotFoundError('Aprovacao nao encontrada', { code: 'MESSAGE_APPROVAL_NOT_FOUND', domain: 'message-approvals' });
  return shapeApproval(item);
}

export async function listApprovals(options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return approvals.filter((row) => row.account_id === accountId).map(shapeApproval).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function listPendingApprovals(options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return approvals.filter((row) => row.account_id === accountId && row.status === 'pending').map(shapeApproval).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function getApprovalByDraftId(draftId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const item = approvals.find((row) => row.account_id === accountId && row.draft_id === draftId) || null;
  return item ? shapeApproval(item) : null;
}

async function updateDraftStatus(draftId, status, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const draft = __getMutableMessageDraftById(draftId, { accountId });
  if (!draft) throw new NotFoundError('Draft nao encontrado', { code: 'MESSAGE_DRAFT_NOT_FOUND', domain: 'message-approvals' });
  draft.status = status;
  draft.updated_at = now();
  return draft;
}

async function recordAuditEvent(accountId, conversationId, type, payload = {}, createdBy = null) {
  if (!conversationId) return null;
  await getConversationById(conversationId, { accountId });
  return addEvent(conversationId, { type, payload }, { accountId, createdBy });
}

export async function approveDraft(draftId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const approval = approvals.find((row) => row.account_id === accountId && row.draft_id === draftId && row.status === 'pending') || null;
  const draft = await updateDraftStatus(draftId, 'approved', { accountId });
  const item = approval || await createApproval({ draftId, status: 'approved' }, { accountId });
  item.status = 'approved';
  item.reviewer_id = options.reviewerId || null;
  item.reviewer_name = options.reviewerName || null;
  item.comment = String(options.comment || '').trim() || null;
  item.updated_at = now();
  item.conversation_id = draft.conversation_id || item.conversation_id || null;
  item.cliente_id = draft.cliente_id || item.cliente_id || null;
  await recordAuditEvent(accountId, draft.conversation_id, 'draft_approved', { draft_id: draft.id, approval_id: item.id, comment: item.comment }, options.reviewerId || options.reviewerName || null);
  return shapeApproval(item);
}

export async function rejectDraft(draftId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const reason = String(options.comment || '').trim();
  if (!reason) throw new ValidationError('comment obrigatorio', { domain: 'message-approvals' });
  const approval = approvals.find((row) => row.account_id === accountId && row.draft_id === draftId && row.status === 'pending') || null;
  const draft = await updateDraftStatus(draftId, 'rejected', { accountId });
  const item = approval || await createApproval({ draftId, status: 'rejected', comment: reason }, { accountId });
  item.status = 'rejected';
  item.reviewer_id = options.reviewerId || null;
  item.reviewer_name = options.reviewerName || null;
  item.comment = reason;
  item.updated_at = now();
  item.conversation_id = draft.conversation_id || item.conversation_id || null;
  item.cliente_id = draft.cliente_id || item.cliente_id || null;
  await recordAuditEvent(accountId, draft.conversation_id, 'draft_rejected', { draft_id: draft.id, approval_id: item.id, comment: reason }, options.reviewerId || options.reviewerName || null);
  return shapeApproval(item);
}

export function __resetMemoryMessageApprovalsForTests() { approvals.length = 0; }
