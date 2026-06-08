import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

let supabaseSingleton = null;

export function isSupabaseConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseStatus() {
  return {
    configured: isSupabaseConfigured(),
    urlConfigured: Boolean(env.SUPABASE_URL),
    serviceRoleConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    anonKeyConfigured: Boolean(env.SUPABASE_ANON_KEY)
  };
}

export function getSupabaseAuthContext(context = {}) {
  return {
    accountId: context?.auth?.accountId || null,
    role: context?.auth?.role || null,
    userId: context?.auth?.userId || null,
    token: context?.auth?.token || null
  };
}

export function buildTenantHeaders(context = {}) {
  const { accountId } = getSupabaseAuthContext(context);
  return {
    'x-account-id': accountId || ''
  };
}

export function createSupabaseClient() {
  const status = getSupabaseStatus();
  if (!status.urlConfigured || !status.serviceRoleConfigured) {
    logger.warn('Supabase client nao configurado completamente', {
      domain: 'core-platform',
      supabase: status
    });
    return null;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      transport: ws
    }
  });
}

export async function resolveAccountMembership(supabase, userId, email = null) {
  if (!supabase || !userId) return null;

  const tables = ['account_users', 'accounts_users', 'user_accounts'];
  const selectColumns = 'account_id, role, email, auth_user_id';

  const queryMembership = async (column, value) => {
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select(selectColumns)
        .eq(column, value)
        .limit(1)
        .maybeSingle();

      if (!error && data?.account_id) {
        return {
          account_id: data.account_id,
          role: data.role || null,
          email: data.email || null,
          auth_user_id: data.auth_user_id || null
        };
      }
    }
    return null;
  };

  const byAuthUserId = await queryMembership('auth_user_id', userId);
  if (byAuthUserId) return byAuthUserId;

  if (email) {
    const byEmail = await queryMembership('email', email);
    if (byEmail) return byEmail;
  }

  return null;
}

export function getSupabaseClient() {
  if (globalThis.__NEURALHIRE_SUPABASE_MOCK__) return globalThis.__NEURALHIRE_SUPABASE_MOCK__;
  if (supabaseSingleton) return supabaseSingleton;
  supabaseSingleton = createSupabaseClient();
  return supabaseSingleton;
}
