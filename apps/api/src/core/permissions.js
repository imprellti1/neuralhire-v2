export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ACCOUNT_ADMIN: 'account_admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  SALES: 'sales',
  VIEWER: 'viewer',
  USER: 'user'
};

export const ROLE_HIERARCHY = {
  super_admin: 100,
  account_admin: 85,
  owner: 90,
  admin: 80,
  manager: 60,
  sales: 40,
  viewer: 20,
  user: 10
};

export const PERMISSIONS = {
  CLIENTES_READ: 'clientes:read',
  CLIENTES_WRITE: 'clientes:write',
  FABRICANTES_READ: 'fabricantes:read',
  FABRICANTES_WRITE: 'fabricantes:write',
  VENDEDORES_READ: 'vendedores:read',
  VENDEDORES_WRITE: 'vendedores:write',
  PEDIDOS_READ: 'pedidos:read',
  PEDIDOS_WRITE: 'pedidos:write',
  PEDIDOS_STATUS_UPDATE: 'pedidos:status:update',
  PRODUTOS_READ: 'produtos:read',
  PRODUTOS_WRITE: 'produtos:write',
  ANALYTICS_READ: 'analytics:read',
  FOLLOWUP_READ: 'followup:read',
  FOLLOWUP_WRITE: 'followup:write',
  MESSAGE_APPROVALS_READ: 'followup:read',
  MESSAGE_APPROVALS_WRITE: 'followup:write',
  SYSTEM_ADMIN: 'system:admin'
};

export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  account_admin: ['clientes:read', 'clientes:write', 'fabricantes:read', 'fabricantes:write', 'vendedores:read', 'vendedores:write', 'pedidos:read', 'pedidos:write', 'pedidos:status:update', 'produtos:read', 'produtos:write', 'analytics:read', 'followup:read', 'followup:write', 'system:admin'],
  owner: ['clientes:read', 'clientes:write', 'fabricantes:read', 'fabricantes:write', 'pedidos:read', 'pedidos:write', 'pedidos:status:update', 'produtos:read', 'produtos:write', 'analytics:read', 'followup:read', 'followup:write', 'system:admin'],
  admin: [
    'clientes:read', 'clientes:write', 'fabricantes:read', 'fabricantes:write', 'vendedores:read', 'vendedores:write', 'pedidos:read', 'pedidos:write', 'pedidos:status:update',
    'produtos:read', 'produtos:write', 'analytics:read', 'followup:read', 'followup:write', 'system:admin'
  ],
  manager: ['clientes:read', 'clientes:write', 'fabricantes:read', 'pedidos:read', 'pedidos:write', 'pedidos:status:update', 'produtos:read', 'analytics:read', 'followup:read', 'followup:write'],
  sales: ['clientes:read', 'clientes:write', 'fabricantes:read', 'pedidos:read', 'pedidos:write', 'produtos:read', 'analytics:read', 'followup:read'],
  viewer: ['clientes:read', 'fabricantes:read', 'pedidos:read', 'produtos:read', 'analytics:read'],
  user: []
};

export function normalizeRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (!(normalized in ROLE_HIERARCHY)) return ROLES.USER;
  return normalized;
}

export function hasRoleLevel(userRole, requiredRole) {
  const current = normalizeRole(userRole);
  const required = normalizeRole(requiredRole);
  if (current === ROLES.SUPER_ADMIN) return true;
  return (ROLE_HIERARCHY[current] || 0) >= (ROLE_HIERARCHY[required] || 0);
}

export function getRolePermissions(role) {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS.user;
}

export function hasPermission(role, permission) {
  const permissions = getRolePermissions(role);
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}



