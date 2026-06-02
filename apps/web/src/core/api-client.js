function resolveDefaultApiUrl() {
  if (typeof window !== 'undefined' && window.__NEURALHIRE_CONFIG__?.VITE_API_URL) {
    return window.__NEURALHIRE_CONFIG__.VITE_API_URL;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  return 'http://localhost:3000';
}

function resolveRuntimeConfig() {
  const runtimeConfig = typeof window !== 'undefined' ? window.__NEURALHIRE_CONFIG__ || {} : {};
  const envConfig = typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {};
  return {
    VITE_APP_ENV: runtimeConfig.VITE_APP_ENV || envConfig.VITE_APP_ENV,
    VITE_DEMO_ACCOUNT_ID: runtimeConfig.VITE_DEMO_ACCOUNT_ID || envConfig.VITE_DEMO_ACCOUNT_ID,
    VITE_DEMO_ROLE: runtimeConfig.VITE_DEMO_ROLE || envConfig.VITE_DEMO_ROLE,
    VITE_DEMO_USER_ID: runtimeConfig.VITE_DEMO_USER_ID || envConfig.VITE_DEMO_USER_ID
  };
}

export function createApiClient(baseUrl = resolveDefaultApiUrl()) {
  const runtimeConfig = resolveRuntimeConfig();

  function isHomologationDemoEnabled() {
    return String(runtimeConfig.VITE_APP_ENV || '').toLowerCase() === 'homologation' && Boolean(runtimeConfig.VITE_DEMO_ACCOUNT_ID);
  }

  function withDemoTenantHeaders(headers = {}) {
    const merged = { ...headers };
    const hasAuthorization = Boolean(merged.Authorization || merged.authorization);
    if (isHomologationDemoEnabled() && !hasAuthorization) {
      merged['x-test-account-id'] = merged['x-test-account-id'] || runtimeConfig.VITE_DEMO_ACCOUNT_ID;
      if (runtimeConfig.VITE_DEMO_ROLE) merged['x-test-role'] = merged['x-test-role'] || runtimeConfig.VITE_DEMO_ROLE;
      if (runtimeConfig.VITE_DEMO_USER_ID) merged['x-test-user-id'] = merged['x-test-user-id'] || runtimeConfig.VITE_DEMO_USER_ID;
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
        ...withDemoTenantHeaders(headers)
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
        ...withDemoTenantHeaders(headers)
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
        ...withDemoTenantHeaders(headers)
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

