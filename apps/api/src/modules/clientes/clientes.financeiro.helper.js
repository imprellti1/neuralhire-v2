function normalizeStatusText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getPedidoStatusComercial(pedido = {}) {
  return normalizeStatusText(pedido?.status || pedido?.metadata?.status || pedido?.metadata?.situacao);
}

export function isPedidoFaturadoComercial(pedidoOrStatus = {}) {
  const status = typeof pedidoOrStatus === 'string' ? pedidoOrStatus : getPedidoStatusComercial(pedidoOrStatus);
  return ['faturado', 'faturado_total', 'faturado_parcial'].includes(normalizeStatusText(status));
}

export function isPedidoExcluidoComercial(pedidoOrStatus = {}) {
  const status = typeof pedidoOrStatus === 'string' ? pedidoOrStatus : getPedidoStatusComercial(pedidoOrStatus);
  return ['cancelado', 'rejeitado', 'estornado'].includes(normalizeStatusText(status));
}

