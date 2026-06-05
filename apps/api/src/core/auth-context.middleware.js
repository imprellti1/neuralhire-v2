import { getSupabaseClient, getSupabaseStatus, resolveAccountMembership } from '../database/supabase.client.js';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from './errors.js';

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function getAccountIdFromUser(user) {
  return user?.app_metadata?.account_id
    || user?.app_metadata?.accountId
    || user?.user_metadata?.account_id
    || user?.user_metadata?.accountId
    || null;
}

function buildJwtClaims({ role = null, accountId = null, rawAvailable = false } = {}) {
  return {
    role,
    account_id: accountId,
    rawAvailable
  };
}

function allowTestTransport() {
  const appEnv = String(env.APP_ENV || '').toLowerCase();
  return appEnv === 'development' || appEnv === 'test' || env.NODE_ENV === 'test';
}

export function authContextMiddleware() {
  return async (req, res, context) => {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const token = parseBearerToken(authHeader);
    const allowTestHeaders = allowTestTransport();
    const testRole = allowTestHeaders ? (req.headers?.['x-test-role'] || req.headers?.['X-Test-Role']) : null;
    const testAccountId = allowTestHeaders ? (req.headers?.['x-test-account-id'] || req.headers?.['X-Test-Account-Id']) : null;
    const testUserId = allowTestHeaders ? (req.headers?.['x-test-user-id'] || req.headers?.['X-Test-User-Id']) : null;

    context.auth = {
      authenticated: false,
      tokenPresent: Boolean(token || testRole),
      userId: null,
      email: null,
      role: null,
      accountId: null,
      source: 'anonymous',
      authError: null,
      jwtClaims: buildJwtClaims()
    };

    if (env.AUTH_MODE === 'supabase' && testRole) {
      context.auth.authError = 'TEST_HEADERS_DISABLED';
      return true;
    }

    if (testRole) {
      const normalizedRole = String(testRole).toLowerCase();
      const normalizedAccountId = testAccountId || null;
      context.auth = {
        authenticated: true,
        tokenPresent: true,
        userId: testUserId || 'test-user-id',
        email: 'test@local',
        role: normalizedRole,
        accountId: normalizedAccountId,
        source: 'test',
        authError: null,
        jwtClaims: buildJwtClaims({ role: normalizedRole, accountId: normalizedAccountId, rawAvailable: true })
      };
      context.accountId = normalizedAccountId;
      return true;
    }

    if (!token) return true;

    const supabase = getSupabaseClient();
    const supabaseStatus = getSupabaseStatus();

    if (!supabase) {
      context.auth = {
        ...context.auth,
        tokenPresent: true,
        authError: supabaseStatus.configured ? 'SUPABASE_UNAVAILABLE' : 'SUPABASE_NOT_CONFIGURED'
      };
      return true;
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw new UnauthorizedError('Token Supabase invalido', {
        code: 'INVALID_TOKEN',
        domain: 'autenticacao-contas',
        details: { supabaseConfigured: supabaseStatus.configured, source: 'supabase' }
      });
    }

    const user = data.user;
    const membership = await resolveAccountMembership(supabase, user.id, user.email);
    const role = membership?.role || user.app_metadata?.role || user.user_metadata?.role || 'user';
    const accountId = membership?.account_id || getAccountIdFromUser(user);

    if (!accountId) {
      throw new ForbiddenError('Usuario sem vinculo com conta', {
        code: 'ACCOUNT_MEMBERSHIP_REQUIRED',
        domain: 'autenticacao-contas',
        details: { userId: user.id }
      });
    }

    context.auth = {
      authenticated: true,
      tokenPresent: true,
      userId: user.id || null,
      email: user.email || null,
      role,
      accountId,
      token,
      source: 'supabase',
      authError: null,
      jwtClaims: buildJwtClaims({ role, accountId, rawAvailable: true })
    };
    context.auth.accountId = accountId;
    context.accountId = accountId;

    return true;
  };
}
