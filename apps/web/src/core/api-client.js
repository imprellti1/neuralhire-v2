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
  const runtimeConfig = typeof window !== 'undefined' ? window.__NEURALHIRE_CONFIG__ || {} : {};
  const envConfig = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
  const appEnv = runtimeConfig.VITE_APP_ENV || envConfig.VITE_APP_ENV;
  const demoAccountId = runtimeConfig.VITE_DEMO_ACCOUNT_ID || envConfig.VITE_DEMO_ACCOUNT_ID;
  const demoRole = runtimeConfig.VITE_DEMO_ROLE || envConfig.VITE_DEMO_ROLE;
  const demoUserId = runtimeConfig.VITE_DEMO_USER_ID || envConfig.VITE_DEMO_USER_ID;

  function buildHeaders(headers = {}) {
    const mergedHeaders = {
      'content-type': 'application/json',
      ...(headers || {})
    };

    const hasAuthorization = Boolean(mergedHeaders.Authorization || mergedHeaders.authorization);

    if (!hasAuthorization && String(appEnv || '').toLowerCase() === 'homologation' && demoAccountId) {
      mergedHeaders['x-test-account-id'] = demoAccountId;

      if (demoRole) {
        mergedHeaders['x-test-role'] = demoRole;
      }

      if (demoUserId) {
        mergedHeaders['x-test-user-id'] = demoUserId;
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

    console.info('[NeuralHire API Client]', {
      appEnv,
      demoAccountId,
      demoRole,
      headers: finalHeaders
    });

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

