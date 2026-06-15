function asDate(value) {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? null : d;
}

function getClientName(item = {}) {
  const candidates = [
    item?.cliente?.empresa,
    item?.cliente?.razao_social,
    item?.cliente?.nome_contato,
    item?.cliente?.nome,
    item?.cliente_nome,
    item?.clienteNome,
    item?.customerName,
    item?.empresa,
    item?.razao_social,
    item?.nome_contato,
    item?.nome
  ];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (!text) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) continue;
    return text;
  }
  return '-';
}

function getOrderCode(item = {}) {
  const candidates = [
    item?.numero,
    item?.numero_pedido,
    item?.pedido_numero,
    item?.codigo,
    item?.code
  ];

  for (const value of candidates) {
    const text = String(value || '').trim();
    if (!text) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) continue;
    return text;
  }

  return '-';
}

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('rascun')) return 'Rascunho';
  if (s.includes('aprova')) return 'Aprovado';
  if (s.includes('confirm')) return 'Confirmado';
  if (s.includes('fatura')) return 'Faturado';
  if (s.includes('cancel')) return 'Cancelado';
  return status || '-';
}

function inPeriod(date, period) {
  if (!date || period === 'all') return true;
  const now = new Date();
  const start = new Date(now);
  if (period === '7d') start.setDate(now.getDate() - 7);
  if (period === '30d') start.setDate(now.getDate() - 30);
  if (period === '90d') start.setDate(now.getDate() - 90);
  if (period === 'month') start.setDate(1);
  return date >= start && date <= now;
}

export function mapPedidosData(response = {}, filters = {}) {
  const rawItems = Array.isArray(response?.items) ? response.items : [];
  const query = String(filters?.search || '').trim().toLowerCase();
  const statusFilter = String(filters?.status || 'all').toLowerCase();
  const periodFilter = String(filters?.period || 'all').toLowerCase();

  const items = rawItems
    .map((item) => {
      const statusExibicao = normalizeStatus(item?.status || item?.situacao || item?.pedido_status || '-');
      const criadoEmExibicao = asDate(item?.created_at || item?.createdAt || item?.criado_em || item?.data_criacao);
      return {
        ...item,
        pedidoExibicao: getOrderCode(item),
        clienteExibicao: getClientName(item),
        statusExibicao,
        origemExibicao: item?.origem || item?.canal || item?.source || '-',
        valorTotalExibicao: Number(item?.valor_total ?? item?.total ?? item?.valor ?? 0),
        criadoEmExibicao,
        dataEmissaoExibicao: asDate(item?.data_emissao || item?.dataEmissao)
      };
    })
    .filter((item) => {
      const statusOk = statusFilter === 'all' || String(item?.statusExibicao || '').toLowerCase() === statusFilter;
      const periodOk = inPeriod(item?.criadoEmExibicao, periodFilter);
      const queryOk = !query || [item?.pedidoExibicao, item?.clienteExibicao, item?.statusExibicao, item?.origemExibicao]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return statusOk && periodOk && queryOk;
    });

  const page = Number(response?.pagination?.page ?? response?.page ?? 1) || 1;
  const limit = Number(response?.pagination?.limit ?? response?.limit ?? 10) || 10;
  const total = Number(response?.pagination?.total ?? response?.pagination?.totalItems ?? response?.pagination?.count ?? response?.total ?? items?.length ?? 0) || 0;
  const totalPagesFromApi = Number(response?.pagination?.totalPages ?? response?.totalPages ?? 0) || 0;
  const totalPages = totalPagesFromApi > 0 ? totalPagesFromApi : Math.max(1, Math.ceil(Math.max(total, items.length, 1) / limit));

  return {
    items,
    pagination: { page, limit, total, totalPages }
  };
}
