function ok(body) { return { ok: true, status: 200, json: async () => body }; }
function fail(status, body = {}) { return { ok: false, status, json: async () => body }; }
function notFound() { return fail(404, { error: { message: 'not found' } }); }

const SENSITIVE_FIELDS = new Set(['account_id', 'accountId', 'tenant_id', 'tenantId', 'owner_user_id', 'ownerUserId', 'token']);
const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'token']);
const ALLOWED_HEADERS = new Set(['x-test-account-id']);

let capturedCalls = [];

function parseJsonSafe(raw) {
  if (!raw || typeof raw !== 'string') return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function hasSensitiveKey(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) return true;
    if (value && typeof value === 'object' && hasSensitiveKey(value)) return true;
  }
  return false;
}

export function getCapturedFetchCalls() {
  return [...capturedCalls];
}
function sanitizeValue(value) {
  return value === undefined ? undefined : '[REDACTED]';
}
function sanitizeRecord(record = {}) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    const lowerKey = String(key).toLowerCase();
    const rawValue = typeof value === 'string' ? value : String(value ?? '');
    const hasBearer = rawValue.toLowerCase().includes('bearer');
    const shouldRedact =
      (SENSITIVE_FIELDS.has(key) && !ALLOWED_HEADERS.has(key)) ||
      SENSITIVE_HEADER_KEYS.has(lowerKey) ||
      hasBearer;
    out[key] = shouldRedact ? sanitizeValue(value) : value;
  }
  return out;
}
function sanitizeBody(value) {
  if (Array.isArray(value)) return value.map(sanitizeBody);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_FIELDS.has(key) ? sanitizeValue(v) : sanitizeBody(v);
  }
  return out;
}

export function getSanitizedFetchCalls() {
  return capturedCalls.map((call) => ({
    method: call.method,
    path: call.path,
    query: sanitizeRecord(Object.fromEntries(call.url.searchParams.entries())),
    headers: sanitizeRecord(call.headers),
    body: sanitizeBody(call.body)
  }));
}

export function resetFetchCalls() {
  capturedCalls = [];
}

export function assertNoSensitiveTransportFields(calls = capturedCalls) {
  for (const call of calls) {
    const { url, headers = {}, body } = call;
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_FIELDS.has(key)) throw new Error(`Campo sensivel encontrado na query: ${key}`);
    }
    for (const key of Object.keys(headers)) {
      const lowerKey = String(key).toLowerCase();
      const value = String(headers[key] ?? '');
      if (SENSITIVE_FIELDS.has(key) && !ALLOWED_HEADERS.has(key)) throw new Error(`Campo sensivel encontrado no header: ${key}`);
      if (SENSITIVE_HEADER_KEYS.has(lowerKey)) throw new Error(`Campo sensivel encontrado no header: ${key}`);
      if (value.toLowerCase().includes('bearer')) throw new Error(`Token bearer encontrado no header: ${key}`);
    }
    if (hasSensitiveKey(body)) throw new Error('Campo sensivel encontrado no body JSON');
  }
}

export function installFetchMock(handlers) {
  resetFetchCalls();
  global.fetch = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    const key = `${method} ${path}`;
    const handler = handlers[key];
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [String(k), String(v)]));
    const body = parseJsonSafe(init.body);

    capturedCalls.push({ method, path, url: parsedUrl, headers, body });

    if (!handler) return notFound();

    const out = handler({ path, method, body, headers, query: Object.fromEntries(parsedUrl.searchParams.entries()) });
    if (out?.__mockError) return fail(out.status || 500, out.body || { error: { message: 'mock error' } });
    return ok(out);
  };
}
