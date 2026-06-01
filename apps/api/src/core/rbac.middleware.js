import { ForbiddenError, UnauthorizedError } from './errors.js';
import { hasPermission, hasRoleLevel, normalizeRole } from './permissions.js';
import { getRoutePermission } from './route-permissions.js';
import { requireTenant } from './tenant.middleware.js';

export function requireRole(requiredRole) {
  return async (req, res, context) => {
    if (context?.auth?.authenticated !== true) {
      throw new UnauthorizedError('Autenticacao obrigatoria', { code: 'AUTH_REQUIRED', domain: 'autenticacao-contas' });
    }

    const currentRole = normalizeRole(context?.auth?.role);
    const normalizedRequired = normalizeRole(requiredRole);

    if (!hasRoleLevel(currentRole, normalizedRequired)) {
      throw new ForbiddenError('Permissao insuficiente para a role requerida', {
        code: 'FORBIDDEN_ROLE',
        domain: 'usuarios-permissoes',
        details: { requiredRole: normalizedRequired, currentRole }
      });
    }

    return true;
  };
}

export function requireAuth() {
  return async (req, res, context) => {
    if (context?.auth?.authenticated !== true) {
      throw new UnauthorizedError('Autenticacao obrigatoria', {
        code: 'AUTH_REQUIRED',
        domain: 'autenticacao-contas',
        details: { tokenPresent: Boolean(context?.auth?.tokenPresent), authError: context?.auth?.authError || null }
      });
    }
    return true;
  };
}

export function requirePermission(permission) {
  return async (req, res, context) => {
    if (context?.auth?.authenticated !== true) {
      throw new UnauthorizedError('Autenticacao obrigatoria', { code: 'AUTH_REQUIRED', domain: 'autenticacao-contas' });
    }

    const role = normalizeRole(context?.auth?.role);
    if (!hasPermission(role, permission)) {
      throw new ForbiddenError('Permissao insuficiente para a acao requerida', {
        code: 'FORBIDDEN_PERMISSION',
        domain: 'usuarios-permissoes',
        details: { permission, role }
      });
    }

    return true;
  };
}

export async function enforceRoutePermission(method, path, req, res, context) {
  const permission = getRoutePermission(method, path);
  if (!permission) return true;
  if (permission.public === true) return true;

  if (permission.authenticated === true) await requireAuth()(req, res, context);
  if (permission.role) await requireRole(permission.role)(req, res, context);
  if (permission.permission) await requirePermission(permission.permission)(req, res, context);
  if (permission.tenantRequired === true) await requireTenant({ domain: permission.domain || 'core-platform' })(req, res, context);

  return true;
}