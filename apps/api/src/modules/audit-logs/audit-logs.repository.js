import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { randomUUID } from 'node:crypto';

const memoryAuditLogs = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'system-audit' });
}

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20;
  return { page, limit: Math.min(rawLimit, 100) };
}

export function getAuditLogsRepositoryMode() {
  return { mode: isSupabaseConfigured() ? 'supabase' : 'memory', supabaseConfigured: isSupabaseConfigured() };
}

export async function listAuditLogs(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const { page, limit } = normalizePagination(filters);
  const supabase = getSupabaseClient();
  if (!supabase) {
    const items = memoryAuditLogs.filter((row) => row.account_id === accountId);
    return { items, total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) };
  }
  let query = supabase.from('system_audit_logs').select('*', { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false });
  if (filters.modulo) query = query.eq('modulo', filters.modulo);
  if (filters.entidade) query = query.eq('entidade', filters.entidade);
  if (filters.entidade_id) query = query.eq('entidade_id', filters.entidade_id);
  if (filters.acao) query = query.eq('acao', filters.acao);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.user_id) query = query.eq('user_id', filters.user_id);
  if (filters.search) {
    const q = String(filters.search).trim();
    if (q) query = query.or(`descricao.ilike.%${q}%,user_email.ilike.%${q}%,user_nome.ilike.%${q}%,erro_mensagem.ilike.%${q}%`);
  }
  if (filters.data_inicial) query = query.gte('created_at', filters.data_inicial);
  if (filters.data_final) query = query.lte('created_at', filters.data_final);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { items: data || [], total: count || 0, page, limit, totalPages: Math.max(1, Math.ceil((count || 0) / limit)) };
}

export function __seedAuditLogForTests(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  const row = {
    id: randomUUID(),
    account_id: accountId,
    modulo: payload.modulo || 'system',
    entidade: payload.entidade || 'geral',
    entidade_id: payload.entidade_id || null,
    acao: payload.acao || 'info',
    descricao: payload.descricao || '',
    status: payload.status || 'success',
    user_id: payload.user_id || null,
    user_email: payload.user_email || null,
    user_nome: payload.user_nome || null,
    erro_codigo: payload.erro_codigo || null,
    erro_mensagem: payload.erro_mensagem || null,
    created_at: payload.created_at || new Date().toISOString()
  };
  memoryAuditLogs.push(row);
  return row;
}

export function __resetAuditLogsForTests() {
  memoryAuditLogs.length = 0;
}

export async function getAuditLogById(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const supabase = getSupabaseClient();
  if (!supabase) throw new NotFoundError('Log nao encontrado', { code: 'AUDIT_LOG_NOT_FOUND', domain: 'system-audit' });
  const { data, error } = await supabase.from('system_audit_logs').select('*').eq('account_id', accountId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError('Log nao encontrado', { code: 'AUDIT_LOG_NOT_FOUND', domain: 'system-audit' });
  return data;
}
