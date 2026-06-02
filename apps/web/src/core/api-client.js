function resolveDefaultApiUrl() {
  if (typeof window !== 'undefined' && window.__NEURALHIRE_CONFIG__?.VITE_API_URL) {
    return window.__NEURALHIRE_CONFIG__.VITE_API_URL;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  return 'http://localhost:3000';
}

export function createApiClient(baseUrl = resolveDefaultApiUrl()) {
  function isLocalDev() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function withDevAuthHeaders(headers = {}) {
    const merged = { ...headers };
    const hasAuthorization = Boolean(merged.Authorization || merged.authorization);
    if (isLocalDev() && !hasAuthorization) {
      merged['x-test-role'] = merged['x-test-role'] || 'manager';
      merged['x-test-account-id'] = merged['x-test-account-id'] || 'acc-analytics-001';
    }
    return merged;
  }

  async function get(path, query = {}, headers = {}) {
    const url = new URL(path, baseUrl);
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        ...withDevAuthHeaders(headers)
      }
    });
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
    const url = new URL(path, baseUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...withDevAuthHeaders(headers)
      },
      body: JSON.stringify(body || {})
    });
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
    const url = new URL(path, baseUrl);
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...withDevAuthHeaders(headers)
      },
      body: JSON.stringify(body || {})
    });
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

