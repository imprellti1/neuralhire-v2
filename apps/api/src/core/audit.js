import { randomUUID } from 'node:crypto';

export function createAuditEvent({
  context,
  domain,
  action,
  status = 'success',
  entity = null,
  metadata = {}
}) {
  return {
    id: randomUUID(),
    requestId: context?.requestId || null,
    domain,
    action,
    status,
    entity,
    metadata,
    createdAt: new Date().toISOString()
  };
}

export function createPedidoAuditEvent({
  context,
  pedidoId,
  action,
  statusAnterior,
  statusNovo,
  motivo
}) {
  return {
    id: randomUUID(),
    requestId: context?.requestId || null,
    domain: 'pedidos-comercial',
    entity: 'pedido',
    entityId: pedidoId,
    action,
    statusAnterior: statusAnterior || null,
    statusNovo,
    motivo: motivo || null,
    actor: {
      userId: context?.auth?.userId || null,
      role: context?.auth?.role || null,
      accountId: context?.auth?.accountId || null
    },
    createdAt: new Date().toISOString()
  };
}
