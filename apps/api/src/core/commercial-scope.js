import { ForbiddenError } from './errors.js';

const FULL_ACCESS_ROLES = new Set(['super_admin', 'account_admin', 'admin', 'manager']);

export function getUserIdFromContext(context = {}) {
  return context?.auth?.userId || context?.auth?.user?.id || null;
}

export function canAccessAllTenantData(context = {}) {
  return FULL_ACCESS_ROLES.has(String(context?.auth?.role || '').toLowerCase());
}

export function resolveOwnerUserIdForCreate(context = {}, payload = {}) {
  const userId = getUserIdFromContext(context);
  if (!canAccessAllTenantData(context)) return userId;
  return payload?.owner_user_id ?? payload?.vendedor_id ?? userId ?? null;
}

export function assertCanAccessOwner(context = {}, ownerUserId) {
  if (canAccessAllTenantData(context)) return;
  const userId = getUserIdFromContext(context);
  if (!ownerUserId || !userId || ownerUserId !== userId) {
    throw new ForbiddenError('Sem permissao para acessar este registro', {
      code: 'OWNER_SCOPE_FORBIDDEN',
      domain: 'commercial-scope'
    });
  }
}

export function applyOwnerFilter(context = {}, queryOrData = {}) {
  if (canAccessAllTenantData(context)) return { ...queryOrData };
  return { ...queryOrData, owner_user_id: getUserIdFromContext(context) };
}
