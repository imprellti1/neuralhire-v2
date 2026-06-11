import { clearAuthSession } from './auth-session.js';

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
    }
    }

    delete mergedHeaders['x-test-account-id'];
    delete mergedHeaders['x-test-role'];
    delete mergedHeaders['x-test-user-id'];
    delete mergedHeaders['X-Test-Account-Id'];
    delete mergedHeaders['X-Test-Role'];
    delete mergedHeaders['X-Test-User-Id'];

  return mergedHeaders;
}

function shouldClearAuthSession(errorBody, status) {
  const errorCode = String(errorBody?.error?.code || '').toUpperCase();
  return status === 401 || errorCode === 'INVALID_TOKEN';
}

  async function request(method, path, options = {}) {
    const { query = {}, body, headers = {} } = options;
    const url = new URL(path, baseUrl);
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });

    const finalHeaders = buildHeaders(headers);
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (isFormData) {
      delete finalHeaders['content-type'];
      delete finalHeaders['Content-Type'];
    }

    const res = await fetch(url.toString(), {
      method,
      headers: finalHeaders,
      ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body || {}) } : {})
    });

    return { res };
  }

  async function get(path, query = {}, headers = {}) {
    const { res } = await request('GET', path, { query, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (shouldClearAuthSession(body, res.status)) clearAuthSession();
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
      if (shouldClearAuthSession(out, res.status)) clearAuthSession();
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
      if (shouldClearAuthSession(out, res.status)) clearAuthSession();
      const err = new Error(out?.error?.message || 'Request failed');
      err.status = res.status;
      err.body = out;
      throw err;
    }
    return out;
  }

  async function put(path, body = {}, headers = {}) {
    const { res } = await request('PUT', path, { body, headers });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (shouldClearAuthSession(out, res.status)) clearAuthSession();
      const err = new Error(out?.error?.message || 'Request failed');
      err.status = res.status;
      err.body = out;
      throw err;
    }
    return out;
  }

  async function del(path, body = {}, headers = {}) {
    const { res } = await request('DELETE', path, { body, headers });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (shouldClearAuthSession(out, res.status)) clearAuthSession();
      const err = new Error(out?.error?.message || 'Request failed');
      err.status = res.status;
      err.body = out;
      throw err;
    }
    return out;
  }

  return { get, post, patch, put, delete: del, baseUrl };
}

