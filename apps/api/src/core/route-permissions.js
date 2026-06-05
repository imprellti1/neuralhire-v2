export const ROUTE_PERMISSIONS = {
  'GET /health': { public: true },
  'GET /system/info': { public: true },
  'GET /system/auth-context': { public: true },
  'POST /system/echo': { authenticated: false },
  'GET /system/protected': { authenticated: true },
  'GET /system/admin-only': { authenticated: true, role: 'admin' },
  'GET /clientes': { authenticated: true, permission: 'clientes:read', tenantRequired: true, domain: 'clientes-crm' },
  'GET /clientes/:id': { authenticated: true, permission: 'clientes:read', tenantRequired: true, domain: 'clientes-crm' },
  'POST /clientes': { authenticated: true, permission: 'clientes:write', tenantRequired: true, domain: 'clientes-crm' },
  'GET /fabricantes': { authenticated: true, permission: 'fabricantes:read', tenantRequired: true, domain: 'fabricantes' },
  'GET /fabricantes/:id': { authenticated: true, permission: 'fabricantes:read', tenantRequired: true, domain: 'fabricantes' },
  'POST /fabricantes': { authenticated: true, permission: 'fabricantes:write', tenantRequired: true, domain: 'fabricantes' },
  'PATCH /fabricantes/:id': { authenticated: true, permission: 'fabricantes:write', tenantRequired: true, domain: 'fabricantes' },
  'GET /fabricantes/:id/condicoes-pagamento': { authenticated: true, permission: 'fabricantes:read', tenantRequired: true, domain: 'fabricantes' },
  'POST /fabricantes/:id/condicoes-pagamento': { authenticated: true, permission: 'fabricantes:write', tenantRequired: true, domain: 'fabricantes' },
  'PATCH /fabricantes/:id/condicoes-pagamento/:condicaoId': { authenticated: true, permission: 'fabricantes:write', tenantRequired: true, domain: 'fabricantes' },
  'GET /produtos': { authenticated: true, permission: 'produtos:read', tenantRequired: true, domain: 'produtos-catalogo' },
  'GET /produtos/search': { authenticated: true, permission: 'produtos:read', tenantRequired: true, domain: 'produtos-catalogo' },
  'GET /produtos/:id': { authenticated: true, permission: 'produtos:read', tenantRequired: true, domain: 'produtos-catalogo' },
  'PATCH /produtos/:id': { authenticated: true, permission: 'produtos:write', tenantRequired: true, domain: 'produtos-catalogo' },
  'POST /produtos': { authenticated: true, permission: 'produtos:write', tenantRequired: true, domain: 'produtos-catalogo' },
  'GET /pedidos': { authenticated: true, permission: 'pedidos:read', tenantRequired: true, domain: 'pedidos-comercial' },
  'GET /pedidos/:id': { authenticated: true, permission: 'pedidos:read', tenantRequired: true, domain: 'pedidos-comercial' },
  'POST /pedidos': { authenticated: true, permission: 'pedidos:write', tenantRequired: true, domain: 'pedidos-comercial' },
  'PATCH /pedidos/:id': { authenticated: true, permission: 'pedidos:write', tenantRequired: true, domain: 'pedidos-comercial' },
  'PATCH /pedidos/:id/itens': { authenticated: true, permission: 'pedidos:write', tenantRequired: true, domain: 'pedidos-comercial' },
  'PATCH /pedidos/:id/status': { authenticated: true, permission: 'pedidos:status:update', tenantRequired: true, domain: 'pedidos-comercial' },
  'GET /analytics/summary': { authenticated: true, permission: 'analytics:read', tenantRequired: true, domain: 'analytics-comercial' },
  'GET /analytics/products': { authenticated: true, permission: 'analytics:read', tenantRequired: true, domain: 'analytics-comercial' },
  'GET /analytics/customers': { authenticated: true, permission: 'analytics:read', tenantRequired: true, domain: 'analytics-comercial' },
  'GET /analytics/timeline': { authenticated: true, permission: 'analytics:read', tenantRequired: true, domain: 'analytics-comercial' },
  'GET /legacy-import/status': { authenticated: true, role: 'manager', tenantRequired: true, domain: 'legacy-import' },
  'POST /legacy-import/preview': { authenticated: true, role: 'manager', tenantRequired: true, domain: 'legacy-import' },
  'POST /legacy-import/validate': { authenticated: true, role: 'manager', tenantRequired: true, domain: 'legacy-import' },
  'POST /legacy-import/execute': { authenticated: true, role: 'manager', tenantRequired: true, domain: 'legacy-import' },
  'GET /message-approvals/pending': { authenticated: true, permission: 'followup:read', tenantRequired: true, domain: 'message-approvals' },
  'GET /message-approvals': { authenticated: true, permission: 'followup:read', tenantRequired: true, domain: 'message-approvals' },
  'GET /message-approvals/:approvalId': { authenticated: true, permission: 'followup:read', tenantRequired: true, domain: 'message-approvals' },
  'GET /message-approvals/draft/:draftId': { authenticated: true, permission: 'followup:read', tenantRequired: true, domain: 'message-approvals' },
  'POST /message-approvals/:draftId/approve': { authenticated: true, role: 'manager', tenantRequired: true, domain: 'message-approvals' },
  'POST /message-approvals/:draftId/reject': { authenticated: true, role: 'manager', tenantRequired: true, domain: 'message-approvals' }
  ,
  'GET /whatsapp/conversations/:conversationId/draft-state': { authenticated: true, permission: 'followup:read', tenantRequired: true, domain: 'whatsapp' },
  'POST /commercial-agent/analyze': { authenticated: true, permission: 'followup:read', tenantRequired: true, domain: 'commercial-agent' },
  'GET /commercial-agent/conversation/:conversationId': { authenticated: true, permission: 'followup:read', tenantRequired: true, domain: 'commercial-agent' }
};

export function getRoutePermissionKey(method, path) {
  return `${String(method || 'GET').toUpperCase()} ${path}`;
}

export function getRoutePermission(method, path) {
  const key = getRoutePermissionKey(method, path);
  return ROUTE_PERMISSIONS[key] || null;
}
