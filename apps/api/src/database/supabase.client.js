import { createClient } from '@supabase/supabase-js';
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
    userId: context?.auth?.userId || null
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
    auth: { persistSession: false }
  });
}

export function getSupabaseClient() {
  if (supabaseSingleton) return supabaseSingleton;
  supabaseSingleton = createSupabaseClient();
  return supabaseSingleton;
}