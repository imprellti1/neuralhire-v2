function toDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }

export function mapOperationalDashboardData(rawItems = [], filters = {}) {
  const start = toDate(filters.startDate);
  const end = toDate(filters.endDate);
  const endMax = end ? new Date(end.getTime() + (24 * 60 * 60 * 1000) - 1) : null;

  let items = rawItems.filter((x) => {
    const d = toDate(x.created_at || x.createdAt);
    if (!d) return false;
    if (start && d < start) return false;
    if (endMax && d > endMax) return false;
    return true;
  });

  if (filters.status && filters.status !== 'all') {
    items = items.filter((x) => String(x.status || '').toLowerCase() === filters.status);
  }

  const statusOrder = ['rascunho', 'aprovado', 'faturado', 'cancelado'];
  const counts = Object.fromEntries(statusOrder.map((s) => [s, 0]));
  items.forEach((x) => { const s = String(x.status || '').toLowerCase(); if (counts[s] !== undefined) counts[s] += 1; });
  const total = items.length || 1;

  const recent = [...items]
    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
    .slice(0, 10)
    .map((x) => ({
      id: x.numero || x.id,
      cliente: (x.empresa || x.razao_social || x.nome_contato || x.cliente_nome || x.clienteNome || x.customerName || x.nome || '-'),
      valor: Number(x.total || 0),
      status: x.status || '-',
      data: x.created_at || x.createdAt
    }));

  const now = Date.now();
  const alerts = [];
  const staleDrafts = items.filter((x) => String(x.status || '').toLowerCase() === 'rascunho' && ((now - new Date(x.created_at || x.createdAt).getTime()) > 3 * 24 * 60 * 60 * 1000)).length;
  const canceledRecent = items.filter((x) => String(x.status || '').toLowerCase() === 'cancelado' && ((now - new Date(x.created_at || x.createdAt).getTime()) <= 7 * 24 * 60 * 60 * 1000)).length;
  const withoutProgress = items.filter((x) => String(x.status || '').toLowerCase() !== 'faturado' && ((now - new Date(x.created_at || x.createdAt).getTime()) > 7 * 24 * 60 * 60 * 1000)).length;
  if (staleDrafts) alerts.push(`${staleDrafts} pedido(s) em rascunho há mais de 3 dias.`);
  if (withoutProgress) alerts.push(`${withoutProgress} pedido(s) sem evolução há mais de 7 dias.`);
  if (canceledRecent) alerts.push(`${canceledRecent} pedido(s) cancelado(s) nos últimos 7 dias.`);

  return {
    resumo: {
      emAberto: counts.rascunho + counts.aprovado,
      confirmados: counts.aprovado,
      faturados: counts.faturado,
      cancelados: counts.cancelado
    },
    funil: statusOrder.map((status) => ({ status, quantidade: counts[status], percentual: Math.round((counts[status] / total) * 100) })),
    pedidosRecentes: recent,
    alertas: alerts,
    empty: items.length === 0
  };
}


