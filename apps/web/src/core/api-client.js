console.error('[API CLIENT M1.11 ACTIVE]');

function resolveDefaultApiUrl() {
  if (typeof window !== 'undefined' && window.__NEURALHIRE_CONFIG__?.VITE_API_URL) {
    return window.__NEURALHIRE_CONFIG__.VITE_API_URL;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
}

function resolveRuntimeConfig() {
  const runtimeConfig = typeof window !== 'undefined' ? window.__NEURALHIRE_CONFIG__ || {} : {};
  const envConfig = typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {};
  return {
    VITE_APP_ENV: runtimeConfig.VITE_APP_ENV || envConfig.VITE_APP_ENV,
    VITE_SUPABASE_URL: runtimeConfig.VITE_SUPABASE_URL || envConfig.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: runtimeConfig.VITE_SUPABASE_ANON_KEY || envConfig.VITE_SUPABASE_ANON_KEY
  };
}

function allowTestHeaders() {
  const runtimeConfig = typeof window !== 'undefined' ? window.__NEURALHIRE_CONFIG__ || {} : {};
  const envConfig = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
  return Boolean(runtimeConfig.ALLOW_TEST_HEADERS || envConfig.ALLOW_TEST_HEADERS);
}

function getStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('neuralhire.supabase.session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createApiClient(baseUrl = resolveDefaultApiUrl()) {
  function buildHeaders(headers = {}) {
    const mergedHeaders = {
      'content-type': 'application/json',
      ...(headers || {})
    };

    const hasAuthorization = Boolean(mergedHeaders.Authorization || mergedHeaders.authorization);
    if (!hasAuthorization) {
      const accessToken = getStoredSession()?.access_token || (typeof window !== 'undefined' ? window.localStorage.getItem('neuralhire.supabase.access_token') : null);
      if (accessToken) {
        mergedHeaders.Authorization = `Bearer ${accessToken}`;
      } else if (allowTestHeaders()) {
        const runtimeConfig = typeof window !== 'undefined' ? window.__NEURALHIRE_CONFIG__ || {} : {};
        const envConfig = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
        const demoAccountId = runtimeConfig.VITE_DEMO_ACCOUNT_ID || envConfig.VITE_DEMO_ACCOUNT_ID;
        const demoRole = runtimeConfig.VITE_DEMO_ROLE || envConfig.VITE_DEMO_ROLE;
        const demoUserId = runtimeConfig.VITE_DEMO_USER_ID || envConfig.VITE_DEMO_USER_ID;
        if (demoAccountId) {
          mergedHeaders['x-test-account-id'] = demoAccountId;
          if (demoRole) mergedHeaders['x-test-role'] = demoRole;
          if (demoUserId) mergedHeaders['x-test-user-id'] = demoUserId;
        }
      }
    }

    return mergedHeaders;
  }

  async function request(method, path, options = {}) {
    const { query = {}, body, headers = {} } = options;
    const url = new URL(path, baseUrl);
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });

    const finalHeaders = buildHeaders(headers);

    const res = await fetch(url.toString(), {
      method,
      headers: finalHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body || {}) } : {})
    });

    return { res };
  }

  async function get(path, query = {}, headers = {}) {
    const { res } = await request('GET', path, { query, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body?.error?.message || 'Request failed');
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  async function post(path, body = {}, headers = {}) {
    const { res } = await request('POST', path, { body, headers });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(out?.error?.message || 'Request failed');
      err.status = res.status;
      err.body = out;
      throw err;
    }
    return out;
  }

  async function patch(path, body = {}, headers = {}) {
    const { res } = await request('PATCH', path, { body, headers });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(out?.error?.message || 'Request failed');
      err.status = res.status;
      err.body = out;
      throw err;
    }
    return out;
  }

  return { get, post, patch, baseUrl };
}

