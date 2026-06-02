import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { isSupabaseConfigured } from '../../database/supabase.client.js';

const drafts = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'message-drafts' });
}

function now() { return new Date().toISOString(); }
function assertNoForbiddenFields(data = {}) {
  for (const key of Object.keys(data)) {
    if (['account_id', 'accountId', 'tenant_id', 'tenantId'].includes(key)) throw new ValidationError(`Campo nao permitido: ${key}`);
  }
}

export function getMessageDraftsRepositoryMode() { return { mode: isSupabaseConfigured() ? 'supabase' : 'memory', supabaseConfigured: isSupabaseConfigured() }; }

export async function saveMessageDraft(data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  assertNoForbiddenFields(data);
  const item = {
    id: randomUUID(),
    account_id: accountId,
    conversation_id: data.conversationId || null,
    cliente_id: data.clienteId || null,
    customer_memory_id: data.customerMemoryId || null,
    draft_type: data.draftType || 'generic',
    status: data.status || 'generated',
    confidence_score: Number(data.confidenceScore || 0),
    reason: data.reason || '',
    context: data.context || {},
    action_id: data.actionId || null,
    action_type: data.actionType || null,
    action_confidence: data.actionConfidence ?? null,
    action_reason: data.actionReason || null,
    draft_text: data.draftText || '',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    created_at: now(),
    updated_at: now()
  };
  drafts.push(item);
  return { ...item };
}

export async function getMessageDraftById(draftId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const item = drafts.find((row) => row.id === draftId && row.account_id === accountId);
  if (!item) throw new NotFoundError('Rascunho nao encontrado', { code: 'MESSAGE_DRAFT_NOT_FOUND', domain: 'message-drafts' });
  return { ...item };
}

export function __getMutableMessageDraftById(draftId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return drafts.find((row) => row.id === draftId && row.account_id === accountId) || null;
}

export async function listMessageDraftsByConversation(conversationId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return drafts.filter((row) => row.account_id === accountId && row.conversation_id === conversationId).map((row) => ({ ...row }));
}

export function __resetMemoryMessageDraftsForTests() { drafts.length = 0; }
