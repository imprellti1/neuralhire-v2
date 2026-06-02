import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { buildApprovalIntelligenceDashboard } from './approval-intelligence.analytics.js';

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'approval-intelligence' });
}

export function getApprovalIntelligenceRepositoryMode() {
  return { mode: isSupabaseConfigured() ? 'supabase' : 'memory', supabaseConfigured: isSupabaseConfigured() };
}

async function fetchRows(accountId) {
  const supabase = getSupabaseClient();
  if (!supabase) return { drafts: [], approvals: [], deliveryLogs: [], actions: [] };
  const [draftsRes, approvalsRes, deliveryRes, actionsRes] = await Promise.all([
    supabase.from('message_drafts').select('*').eq('account_id', accountId),
    supabase.from('message_draft_approvals').select('*').eq('account_id', accountId),
    supabase.from('whatsapp_delivery_logs').select('*').eq('account_id', accountId),
    supabase.from('commercial_agent_actions').select('*').eq('account_id', accountId)
  ]);
  const error = draftsRes.error || approvalsRes.error || deliveryRes.error || actionsRes.error;
  if (error) throw new DatabaseError('Falha ao carregar approval intelligence', { details: error });
  return { drafts: draftsRes.data || [], approvals: approvalsRes.data || [], deliveryLogs: deliveryRes.data || [], actions: actionsRes.data || [] };
}

export async function getApprovalIntelligenceDashboardData(options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const rows = options.rows || await fetchRows(accountId);
  return buildApprovalIntelligenceDashboard(rows);
}

