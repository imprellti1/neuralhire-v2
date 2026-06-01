export function createTestContext(overrides = {}) {
  return {
    requestId: 'test-request-id',
    method: 'GET',
    url: '/',
    startedAt: Date.now(),
    ip: '127.0.0.1',
    userAgent: 'test-runner',
    auth: {
      authenticated: false,
      tokenPresent: false,
      userId: null,
      email: null,
      role: null,
      accountId: null,
      source: 'anonymous'
    },
    ...overrides
  };
}
