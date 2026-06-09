function asDate(value) {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  const d = asDate(value);
  return d ? d.toLocaleDateString('pt-BR') : '-';
}

function fmtBrl(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
}
function fmtNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function normalizeStatus(rawStatus, ativo) {
  const s = String(rawStatus || '').toLowerCase();
  if (['rascunho', 'aprovado', 'confirmado', 'faturado', 'cancelado'].includes(s)) return s;
  if (s === 'ativo' || ativo === true) return 'ativo';
  if (s === 'inativo' || ativo === false) return 'inativo';
  return s || 'desconhecido';
}

function normalizePrice(rawValue) {
  const cleaned = String(rawValue || '').trim().replace(/\s/g, '');
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  return Number(normalized);
}

function normalizeMultiploVenda(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return 1;
  const value = Number(rawValue);
  return Number.isInteger(value) && value >= 1 ? value : NaN;
}

function normalizeText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeDescription(rawDescription, nomeExibicao) {
  const description = String(rawDescription || '').trim();
  const nome = String(nomeExibicao || '').trim();
  if (!description) return '';
  if (description === nome) return '';
  return description;
}

function normalizeArrayResponse(response = {}) {
  if (Array.isArray(response)) return response;
  return response?.items || response?.data || [];
}

function pickVariationStock(item = {}) {
  const candidates = [item?.estoque_atual, item?.estoqueAtual, item?.estoque, item?.saldo_estoque, item?.stock];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function pickVariationUpdatedAt(item = {}) {
  return item?.updated_at || item?.updatedAt || item?.atualizado_em || item?.created_at || item?.createdAt;
}

function normalizeVariationStatus(rawStatus, ativo) {
  const status = normalizeStatus(rawStatus, ativo);
  if (['ativo', 'inativo'].includes(status)) return status;
  return ativo === false ? 'inativo' : 'ativo';
}

function pickImageUrl(item = {}) {
  return item?.imagemUrl || item?.imagem_url || item?.image_url || item?.foto_url || item?.foto || null;
}

export function normalizeProdutoVariations(response = {}) {
  const candidates = [
    response?.variacoes,
    response?.variations,
    response?.produto_variacoes,
    response?.produtoVariacoes,
    response?.item?.variacoes,
    response?.item?.variations,
    response?.item?.variacoes_produto,
    response?.item?.variations_produto,
    response?.item?.produto_variacoes,
    response?.item?.produtoVariacoes,
    response?.items,
    response?.data,
    Array.isArray(response) ? response : null
  ];
  const rawItems = candidates.flatMap((value) => normalizeArrayResponse(value)).filter(Boolean);
  return rawItems.map((item, index) => {
    const status = normalizeVariationStatus(item?.status, item?.ativo);
    const estoque = pickVariationStock(item);
    const updatedAt = asDate(pickVariationUpdatedAt(item));
    return {
      id: item?.id || `${index}`,
      sku: normalizeText(item?.sku || item?.codigo || item?.codigo_erp || item?.referencia, '-'),
      cor: item?.cor || item?.color || null,
      tamanho: item?.tamanho || item?.grade || item?.size || null,
      estoqueAtual: Number(estoque || 0),
      estoque: Number(estoque || 0),
      preco: Number(item?.preco ?? item?.preco_unitario ?? item?.valor ?? 0),
      precoFormatado: fmtBrl(item?.preco ?? item?.preco_unitario ?? item?.valor ?? 0),
      multiploVenda: normalizeMultiploVenda(item?.multiplo_venda ?? item?.multiploVenda),
      status,
      ativo: status === 'ativo',
      statusComercial: normalizeVariationStatus(item?.status_comercial || item?.statusComercial || item?.status, item?.ativo),
      imagemUrl: pickImageUrl(item),
      updatedAt,
      updatedAtFormatado: fmtDate(updatedAt),
      raw: item
    };
  });
}

export function sumProdutoVariationsStock(variations = []) {
  return (Array.isArray(variations) ? variations : []).reduce((sum, variation) => sum + Number(variation?.estoqueAtual ?? variation?.estoque ?? 0), 0);
}

export function mapProdutoDetailsData(response = {}) {
  const item = response?.item || response || {};
  if (!item?.id) return { id: null };
  const nome = String(item?.nome || '').trim();
  const nomeExibicao = !nome || isUuidLike(nome) ? 'Produto não identificado' : nome;
  const criadoEm = asDate(item?.created_at || item?.createdAt);
  const atualizadoEm = asDate(item?.updated_at || item?.updatedAt);
  const status = normalizeStatus(item?.status, item?.ativo);
  return {
    id: item.id,
    nomeExibicao,
    imagemUrl: pickImageUrl(item),
    sku: item?.sku || '-',
    categoria: item?.categoria_nome || item?.categoria || '-',
    descricao: normalizeDescription(item?.descricao, nomeExibicao),
    status,
    ativo: status === 'ativo',
    preco: Number(item?.preco ?? item?.preco_unitario ?? 0),
    precoFormatado: fmtBrl(item?.preco ?? item?.preco_unitario ?? 0),
    multiploVenda: normalizeMultiploVenda(item?.multiplo_venda ?? item?.multiploVenda),
    fabricanteId: item?.fabricante_id || item?.fabricanteId || null,
    fabricanteNome: item?.fabricante_nome || item?.fabricante?.nome || null,
    fabricanteLogoUrl: item?.fabricante_logo_url || item?.fabricante?.logo_url || null,
    fabricanteCnpj: item?.fabricante?.cnpj || item?.fabricante_cnpj || null,
    regrasComerciaisFabricante: item?.regras_comerciais_fabricante || item?.fabricante?.regras_comerciais_fabricante || null,
    variacoes: normalizeProdutoVariations(response),
    estoqueTotalVariacoes: (() => {
      const variations = normalizeProdutoVariations(response);
      if (variations.length) return sumProdutoVariationsStock(variations);
      const consolidated = Number(item?.estoque_total ?? item?.estoqueTotal ?? item?.estoque ?? 0);
      return Number.isFinite(consolidated) ? consolidated : 0;
    })(),
    criadoEm,
    atualizadoEm,
    criadoEmFormatado: fmtDate(criadoEm),
    atualizadoEmFormatado: fmtDate(atualizadoEm),
    idTecnicoAbreviado: String(item.id).slice(0, 8)
  };
}

export function createProdutoEditForm(data = {}) {
  return {
    nome: data?.nomeExibicao && data.nomeExibicao !== 'Produto não identificado' ? data.nomeExibicao : '',
    sku: data?.sku && data.sku !== '-' ? data.sku : '',
    categoria_id: data?.categoria_id || '',
    preco: Number.isFinite(Number(data?.preco)) ? String(Number(data.preco).toFixed(2)).replace('.', ',') : '',
    preco_promocional: Number.isFinite(Number(data?.preco_promocional)) ? String(Number(data.preco_promocional).toFixed(2)).replace('.', ',') : '',
    icms_percentual: Number.isFinite(Number(data?.icms_percentual)) ? String(Number(data.icms_percentual).toFixed(2)).replace('.', ',') : '',
    multiplo_venda: Number.isInteger(Number(data?.multiploVenda ?? data?.multiplo_venda)) && Number(data?.multiploVenda ?? data?.multiplo_venda) >= 1 ? String(Math.trunc(Number(data?.multiploVenda ?? data?.multiplo_venda))) : '1',
    video_url: data?.video_url || '',
    descricao: data?.descricao || '',
    status: data?.status === 'inativo' ? 'inativo' : 'ativo',
    fabricante_id: data?.fabricanteId || ''
  };
}

export function validateProdutoEditForm(form = {}) {
  const fieldErrors = {};
  if (!String(form.nome || '').trim()) fieldErrors.nome = 'Nome é obrigatório.';
  const preco = normalizePrice(form.preco);
  if (!String(form.preco || '').trim()) fieldErrors.preco = 'Preço é obrigatório.';
  else if (!Number.isFinite(preco) || preco <= 0) fieldErrors.preco = 'Preço deve ser maior que zero.';
  const multiploVenda = normalizeMultiploVenda(form.multiplo_venda);
  if (String(form.multiplo_venda || '').trim() && !Number.isFinite(multiploVenda)) fieldErrors.multiplo_venda = 'Múltiplo de venda deve ser um inteiro maior ou igual a 1.';
  const status = String(form.status || '').toLowerCase();
  if (status !== 'ativo' && status !== 'inativo') fieldErrors.status = 'Status deve ser ativo ou inativo.';
  return fieldErrors;
}

export function mapProdutoUpdatePayload(form = {}) {
  const preco = normalizePrice(form.preco);
  const status = String(form.status || 'ativo').toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
  return {
    nome: String(form.nome || '').trim(),
    descricao: String(form.descricao || '').trim() || undefined,
    sku: String(form.sku || '').trim() || undefined,
    categoria_id: String(form.categoria_id || '').trim() || undefined,
    fabricante_id: form.fabricante_id ? String(form.fabricante_id).trim() : null,
    preco,
    preco_promocional: normalizePrice(form.preco_promocional),
    icms_percentual: normalizePrice(form.icms_percentual),
    multiplo_venda: normalizeMultiploVenda(form.multiplo_venda),
    video_url: String(form.video_url || '').trim() || undefined,
    preco_unitario: preco,
    status,
    ativo: status === 'ativo'
  };
}

function getClienteNome(pedido = {}) {
  const candidates = [pedido?.cliente_nome, pedido?.cliente?.empresa, pedido?.cliente?.razao_social, pedido?.cliente?.nome, pedido?.nome];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (!text || isUuidLike(text)) continue;
    return text;
  }
  return 'Cliente não identificado';
}

export function mapProdutoUsageData(produtoId, pedidos = []) {
  const normalized = [];
  for (const pedido of pedidos) {
    const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
    const matching = itens.filter((item) => String(item?.produto_id || '') === String(produtoId || ''));
    if (!matching.length) continue;
    const quantidade = matching.reduce((sum, item) => sum + Number(item?.quantidade || 0), 0);
    const totalItem = matching.reduce((sum, item) => sum + Number(item?.total ?? (Number(item?.preco_unitario || 0) * Number(item?.quantidade || 0))), 0);
    const createdAt = asDate(pedido?.created_at || pedido?.createdAt);
    normalized.push({
      id: pedido?.id,
      numero: String(pedido?.numero || '').trim() || '-',
      clienteNome: getClienteNome(pedido),
      status: normalizeStatus(pedido?.status, true),
      quantidade,
      valorUnitario: quantidade > 0 ? totalItem / quantidade : 0,
      totalItem,
      totalPedido: Number(pedido?.total || 0),
      criadoEm: createdAt,
      criadoEmFormatado: fmtDate(createdAt)
    });
  }
  normalized.sort((a, b) => Number(b?.criadoEm?.getTime() || 0) - Number(a?.criadoEm?.getTime() || 0));
  const totalPedidos = normalized.length;
  const quantidadeVendida = normalized.reduce((sum, item) => sum + item.quantidade, 0);
  const faturamentoTotal = normalized.reduce((sum, item) => sum + item.totalItem, 0);
  const ultimaVenda = normalized[0]?.criadoEm || null;
  return {
    allPedidos: normalized,
    ...buildUsageView(normalized, { period: 'todos', status: 'todos' })
  };
}

function getPeriodStart(period) {
  if (period === '7d' || period === '30d' || period === '90d') {
    const days = Number(period.replace('d', ''));
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return d;
  }
  return null;
}
function getPreviousPeriodRange(period) {
  if (!['7d', '30d', '90d'].includes(String(period || ''))) return null;
  const days = Number(String(period).replace('d', ''));
  const currentStart = new Date();
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(currentStart.getDate() - days);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);
  return { previousStart, previousEnd };
}
function percentageDelta(current, previous) {
  const a = Number(current || 0);
  const b = Number(previous || 0);
  if (b === 0 && a > 0) return null;
  if (b === 0 && a === 0) return 0;
  return ((a - b) / b) * 100;
}
function buildCompareLabel(current, previous) {
  const delta = percentageDelta(current, previous);
  if (delta === null) return { kind: 'new', text: 'Novo movimento' };
  if (delta === 0) return { kind: 'neutral', text: 'Sem variação' };
  const sign = delta > 0 ? '+' : '';
  return { kind: delta > 0 ? 'positive' : 'negative', text: `${sign}${fmtNumber(delta)}%` };
}
function sanitizeFileSlug(raw) {
  const base = String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'produto';
}

function formatBucketLabel(date, mode) {
  if (mode === 'mes') return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  return date.toLocaleDateString('pt-BR');
}

function buildUsageView(items = [], filters = {}) {
  const period = String(filters?.period || 'todos');
  const status = String(filters?.status || 'todos').toLowerCase();
  const start = getPeriodStart(period);
  const filtered = items.filter((item) => {
    const statusOk = status === 'todos' ? true : String(item?.status || '').toLowerCase() === status;
    const dateOk = !start ? true : ((item?.criadoEm instanceof Date) && item.criadoEm >= start);
    return statusOk && dateOk;
  });
  filtered.sort((a, b) => Number(b?.criadoEm?.getTime() || 0) - Number(a?.criadoEm?.getTime() || 0));
  const previousRange = getPreviousPeriodRange(period);
  const previousFiltered = previousRange
    ? items.filter((item) => {
      const statusOk = status === 'todos' ? true : String(item?.status || '').toLowerCase() === status;
      const date = item?.criadoEm instanceof Date ? item.criadoEm : null;
      const dateOk = date && date >= previousRange.previousStart && date <= previousRange.previousEnd;
      return statusOk && dateOk;
    })
    : [];

  const totalPedidos = filtered.length;
  const quantidadeVendida = filtered.reduce((sum, item) => sum + Number(item?.quantidade || 0), 0);
  const faturamentoTotal = filtered.reduce((sum, item) => sum + Number(item?.totalItem || 0), 0);
  const ticketMedioProduto = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;
  const prevTotalPedidos = previousFiltered.length;
  const prevQuantidadeVendida = previousFiltered.reduce((sum, item) => sum + Number(item?.quantidade || 0), 0);
  const prevFaturamentoTotal = previousFiltered.reduce((sum, item) => sum + Number(item?.totalItem || 0), 0);
  const prevTicketMedioProduto = prevTotalPedidos > 0 ? prevFaturamentoTotal / prevTotalPedidos : 0;
  const ultimaVenda = filtered[0]?.criadoEm || null;

  const first = filtered[filtered.length - 1]?.criadoEm;
  const last = filtered[0]?.criadoEm;
  const spanDays = (first && last) ? Math.ceil((last.getTime() - first.getTime()) / 86400000) : 0;
  const mode = spanDays > 45 ? 'mes' : 'dia';
  const buckets = new Map();
  filtered.forEach((item) => {
    if (!(item?.criadoEm instanceof Date)) return;
    const d = item.criadoEm;
    const key = mode === 'mes'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, { date: new Date(d.getFullYear(), d.getMonth(), mode === 'mes' ? 1 : d.getDate()), quantidade: 0, faturamento: 0 });
    const current = buckets.get(key);
    current.quantidade += Number(item?.quantidade || 0);
    current.faturamento += Number(item?.totalItem || 0);
  });
  const serieTemporal = Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => {
      const key = mode === 'mes'
        ? `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`
        : `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}-${String(item.date.getDate()).padStart(2, '0')}`;
      return { key, label: formatBucketLabel(item.date, mode), quantidade: item.quantidade, faturamento: item.faturamento };
    });

  const comparison = previousRange
    ? {
      enabled: true,
      faturamento: buildCompareLabel(faturamentoTotal, prevFaturamentoTotal),
      quantidadeVendida: buildCompareLabel(quantidadeVendida, prevQuantidadeVendida),
      totalPedidos: buildCompareLabel(totalPedidos, prevTotalPedidos),
      ticketMedioProduto: buildCompareLabel(ticketMedioProduto, prevTicketMedioProduto)
    }
    : {
      enabled: false,
      message: 'Sem comparação para todos os períodos'
    };

  return {
    totalPedidos,
    quantidadeVendida,
    faturamentoTotal,
    ticketMedioProduto,
    ultimaVenda,
    ultimaVendaFormatada: fmtDate(ultimaVenda),
    pedidosRecentes: filtered,
    serieTemporal,
    agrupamentoTemporal: mode,
    comparison
  };
}

export function applyProdutoUsageFilters(usage = {}, filters = {}) {
  return buildUsageView(Array.isArray(usage?.allPedidos) ? usage.allPedidos : [], filters);
}
export function applyProdutoUsageDrillDown(pedidos = [], drillDown = null, mode = 'dia') {
  if (!drillDown) return pedidos;
  return pedidos.filter((item) => {
    const d = item?.criadoEm;
    if (!(d instanceof Date)) return false;
    const key = mode === 'mes'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key === drillDown.key;
  });
}
export function mapProdutoUsageCsvRows(items = []) {
  return items.map((p) => ({
    pedido: String(p?.numero || '-'),
    cliente: String(p?.clienteNome || 'Cliente não identificado'),
    status: String(p?.status || '-'),
    quantidade: String(Number(p?.quantidade || 0)),
    valorUnitario: fmtNumber(p?.valorUnitario || 0),
    valorItem: fmtNumber(p?.totalItem || 0),
    totalPedido: fmtNumber(p?.totalPedido || 0),
    data: String(p?.criadoEmFormatado || '-')
  }));
}
export function mapProdutoUsageCsvContent(rows = []) {
  const header = ['Pedido', 'Cliente', 'Status', 'Quantidade', 'Valor Unitário', 'Valor Item', 'Total Pedido', 'Data'];
  const body = rows.map((r) => [r.pedido, r.cliente, r.status, r.quantidade, r.valorUnitario, r.valorItem, r.totalPedido, r.data]
    .map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(';'));
  return [header.join(';'), ...body].join('\n');
}
export function mapProdutoUsageCsvFilename(data = {}, mode = 'lista') {
  const suffix = mode === 'periodo' ? 'periodo' : 'lista';
  return `produto-${sanitizeFileSlug(data?.nomeExibicao || data?.id || 'produto')}-pedidos-${suffix}.csv`;
}
