export const PEDIDO_STATUS = {
  RASCUNHO: 'rascunho',
  CONFIRMADO: 'confirmado',
  APROVADO: 'aprovado',
  FATURADO: 'faturado',
  CANCELADO: 'cancelado'
};

export const PEDIDO_STATUS_FLOW = {
  rascunho: ['aprovado', 'cancelado'],
  aprovado: ['confirmado', 'faturado', 'cancelado'],
  confirmado: ['faturado', 'cancelado'],
  faturado: [],
  cancelado: ['rascunho']
};

export function isValidPedidoStatus(status) {
  return Object.values(PEDIDO_STATUS).includes(String(status || '').toLowerCase());
}

export function canTransitionPedidoStatus(from, to) {
  const fromKey = String(from || '').toLowerCase();
  const toKey = String(to || '').toLowerCase();
  if (!isValidPedidoStatus(fromKey) || !isValidPedidoStatus(toKey)) return false;
  return (PEDIDO_STATUS_FLOW[fromKey] || []).includes(toKey);
}

export const createPedidoSchema = {
  cliente_id: { required: true, type: 'string', minLength: 1, maxLength: 120 },
  numero: { required: false, type: 'string', maxLength: 60 },
  status: { required: false, type: 'string', enum: Object.values(PEDIDO_STATUS) },
  origem: { required: false, type: 'string', maxLength: 50 },
  observacoes: { required: false, type: 'string', maxLength: 2000 },
  itens: { required: true, type: 'array' }
};

export const updatePedidoStatusSchema = {
  status: { required: true, type: 'string', enum: Object.values(PEDIDO_STATUS) },
  motivo: { required: false, type: 'string', maxLength: 500 }
};

export const updatePedidoItensSchema = {
  itens: { required: true, type: 'array' }
};

export const updatePedidoSchema = {
  cliente_id: { required: true, type: 'string', minLength: 1, maxLength: 120 },
  origem: { required: true, type: 'string', minLength: 1, maxLength: 50 },
  observacoes: { required: false, type: 'string', maxLength: 2000 }
};

export const listPedidosQuerySchema = {
  page: { required: false, type: 'number' },
  limit: { required: false, type: 'number' },
  status: { required: false, type: 'string', maxLength: 30 },
  cliente_id: { required: false, type: 'string', maxLength: 120 }
};
