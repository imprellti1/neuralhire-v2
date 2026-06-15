export const PEDIDO_STATUS = {
  RASCUNHO: 'rascunho',
  CONFIRMADO: 'confirmado',
  APROVADO: 'aprovado',
  FATURADO: 'faturado',
  FATURADO_TOTAL: 'faturado_total',
  FATURADO_PARCIAL: 'faturado_parcial',
  CANCELADO: 'cancelado',
  REJEITADO: 'rejeitado',
  ESTORNADO: 'estornado'
};

export const PEDIDO_STATUS_FLOW = {
  rascunho: ['aprovado', 'cancelado', 'rejeitado'],
  aprovado: ['confirmado', 'faturado', 'faturado_total', 'faturado_parcial', 'cancelado', 'rejeitado', 'estornado'],
  confirmado: ['faturado', 'faturado_total', 'faturado_parcial', 'cancelado', 'rejeitado', 'estornado'],
  faturado: [],
  faturado_total: [],
  faturado_parcial: ['faturado_total', 'cancelado', 'estornado'],
  cancelado: ['rascunho'],
  rejeitado: [],
  estornado: []
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

export const listPedidosAuditoriaQuerySchema = {
  page: { required: false, type: 'number' },
  limit: { required: false, type: 'number' },
  status: { required: false, type: 'string', maxLength: 30 },
  issue: { required: false, type: 'string', enum: ['sem_comissao', 'sem_itens', 'sem_vendedor', 'nao_faturado_total'] },
  search: { required: false, type: 'string', maxLength: 120 }
};

export const updatePedidoComissaoSchema = {
  comissao_principal_percentual: { required: false, type: 'number', min: 0, max: 100 },
  comissao_preposto_percentual: { required: false, type: 'number', min: 0, max: 100 }
};

export const updatePedidoFaturamentoSchema = {
  data_faturamento: { required: true, type: 'string', maxLength: 30 }
};

export const updatePedidoVendedorSchema = {
  vendedor_id: { required: true, type: 'string', minLength: 1, maxLength: 120 }
};
