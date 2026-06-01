import { ForbiddenError } from './errors.js';

export function getAccountIdFromContext(context) {
  return context?.auth?.accountId || null;
}

export function assertTenantContext(context, { domain = 'core-platform' } = {}) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', {
      code: 'TENANT_REQUIRED',
      domain,
      details: { reason: 'account_id_missing' }
    });
  }

  return accountId;
}