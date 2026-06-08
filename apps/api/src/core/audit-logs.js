import { randomUUID } from 'node:crypto';
import { getSupabaseClient, isSupabaseConfigured } from '../database/supabase.client.js';
import { ForbiddenError } from './errors.js';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'password',
  'secret',
  'service_role_key',
  'serviceRoleKey',
  'files',
  'file',
  'raw',
  'payload'
]);

function sanitizeValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[truncated]';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = String(key).trim();
    if (SENSITIVE_KEYS.has(normalizedKey) || /authorization|token|senha|password|secret/i.test(normalizedKey)) {
      out[normalizedKey] = '[redacted]';
      continue;
    }
    out[normalizedKey] = sanitizeValue(item, depth + 1);
  }
  return out;
}

export function sanitizeAuditMetadata(metadata = {}) {
  return sanitizeValue(metadata || {});
}

function normalizeStatus(status, sucesso) {
  const allowed = new Set(['success', 'failed', 'partial']);
  if (allowed.has(status)) return status;
  return sucesso === false ? 'failed' : 'success';
}

function resolveActor(context = {}) {
  return {
    account_id: context?.auth?.accountId || context?.accountId || null,
    user_id: context?.auth?.userId || null,
    user_email: context?.auth?.email || context?.userEmail || null,
    user_nome: context?.auth?.name || context?.auth?.user_name || context?.userNome || null
  };
}

export async function recordAuditLog(context = {}, payload = {}) {
  const accountId = context?.auth?.accountId || context?.accountId || null;
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'system-audit' });
  }

  const row = {
    id: payload.id || randomUUID(),
    ...resolveActor(context),
    modulo: payload.modulo || payload.module || 'core-platform',
    entidade: payload.entidade || payload.entity || null,
    entidade_id: payload.entidade_id || payload.entityId || null,
    acao: payload.acao || payload.action || null,
    descricao: payload.descricao || payload.description || null,
    status: normalizeStatus(payload.status, payload.sucesso),
    sucesso: typeof payload.sucesso === 'boolean' ? payload.sucesso : normalizeStatus(payload.status, payload.sucesso) === 'success',
    request_id: payload.request_id || context?.requestId || null,
    ip: payload.ip || context?.ip || null,
    user_agent: payload.user_agent || context?.userAgent || null,
    metadata: sanitizeAuditMetadata(payload.metadata || {}),
    erro_codigo: payload.erro_codigo || payload.errorCode || null,
    erro_mensagem: payload.erro_mensagem || payload.errorMessage || null,
    account_id: accountId,
    created_at: payload.created_at || new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    globalThis.__NEURALHIRE_AUDIT_LOGS__ = globalThis.__NEURALHIRE_AUDIT_LOGS__ || [];
    globalThis.__NEURALHIRE_AUDIT_LOGS__.push(row);
    return row;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return row;
  const { error } = await supabase.from('system_audit_logs').insert(row);
  if (error) throw error;
  return row;
}

export function __dumpAuditLogsForTests() {
  return (globalThis.__NEURALHIRE_AUDIT_LOGS__ || []).map((item) => ({ ...item }));
}
