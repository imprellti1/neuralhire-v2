function asDate(value) { const d = new Date(value || ''); return Number.isNaN(d.getTime()) ? null : d; }
function isUuidLike(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()); }
function normalizeStatus(status) { const s = String(status || '').toLowerCase(); if (s.includes('rascun')) return 'Rascunho'; if (s.includes('aprova')) return 'Aprovado'; if (s.includes('confirm')) return 'Confirmado'; if (s.includes('fatura')) return 'Faturado'; if (s.includes('cancel')) return 'Cancelado'; return ''; }
function getClienteNome(item = {}) { return item?.empresa || item?.razao_social || item?.nome || 'Cliente não identificado'; }
function getPedidoCode(item = {}) { const code = item?.numero || item?.numero_pedido || item?.pedido_numero || item?.codigo || item?.code || ''; return isUuidLike(code) ? '' : code; }
function belongsToCliente(pedido = {}, cliente = {}) { const pid = String(pedido?.cliente_id || pedido?.cliente?.id || '').trim(); const cid = String(cliente?.id || '').trim(); if (pid && cid && pid === cid) return true; const pnome = String(pedido?.cliente?.empresa || pedido?.cliente?.razao_social || pedido?.cliente_nome || pedido?.empresa || '').trim().toLowerCase(); const cnome = String(getClienteNome(cliente)).trim().toLowerCase(); return Boolean(pnome && cnome && pnome === cnome); }
function getBillingDate(pedido = {}) {
  return asDate(pedido?.data_faturamento || pedido?.faturado_em || pedido?.billed_at || pedido?.updated_at || pedido?.updatedAt || pedido?.data_emissao || pedido?.emitted_at || pedido?.created_at || pedido?.createdAt || pedido?.criado_em);
}
function getLastPurchaseDate(pedido = {}) {
  return getBillingDate(pedido) || asDate(pedido?.created_at || pedido?.createdAt || pedido?.criado_em);
}
function getPedidoFallbackDate(pedido = {}) {
  return asDate(pedido?.data_emissao || pedido?.emitted_at || pedido?.created_at || pedido?.createdAt || pedido?.criado_em);
}
function getStatusKey(status = '') {
  const s = String(status || '').toLowerCase();
  if (s.includes('fatura')) return 'faturado';
  if (s.includes('aberto')) return 'aberto';
  if (s.includes('pend')) return 'pendente';
  if (s.includes('andamento')) return 'em_andamento';
  if (s.includes('cancel')) return 'cancelado';
  return s || 'outros';
}
function getGroupKey(status = '') {
  const s = getStatusKey(status);
  if (s === 'faturado' || s === 'faturado_total' || s === 'faturado_parcial') return 'faturados';
  if (s === 'aberto' || s === 'pendente' || s === 'em_andamento') return 'em_aberto';
  if (s === 'cancelado') return 'cancelados';
  return 'outros';
}
function getGroupPriority(key = '') {
  if (key === 'faturados') return 0;
  if (key === 'em_aberto') return 1;
  if (key === 'cancelados') return 2;
  return 3;
}
function getGroupLabel(key = '') {
  if (key === 'faturados') return 'Faturados';
  if (key === 'em_aberto') return 'Em aberto';
  if (key === 'cancelados') return 'Cancelados';
  return 'Outros';
}
function calcularTotalItem(item = {}) {
  const total = Number(item?.valor_total || item?.total || 0);
  if (total > 0) return total;
  const quantidade = Number(item?.quantidade || 0);
  const unitario = Number(item?.valor_unitario || item?.valorUnitario || item?.preco_unitario || item?.preco || 0);
  return quantidade * unitario;
}
function calcularValorPedido(pedido = {}) {
  const valorPedido = Number(pedido?.valor_total ?? pedido?.valor ?? pedido?.total ?? 0);
  if (valorPedido > 0) return valorPedido;
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  return itens.reduce((soma, item) => soma + calcularTotalItem(item), 0);
}
function getPedidoSortDate(pedido = {}) {
  return getBillingDate(pedido) || getPedidoFallbackDate(pedido);
}
function buildPedidoGroups(pedidos = []) {
  const groupMap = new Map();
  pedidos.forEach((pedido) => {
    const groupKey = getGroupKey(pedido?.status);
    const current = groupMap.get(groupKey) || { key: groupKey, label: getGroupLabel(groupKey), pedidos: [], totalValue: 0, latestBillingDate: null };
    const billingDate = getBillingDate(pedido);
    const fallbackDate = getPedidoFallbackDate(pedido);
    const sortDate = getPedidoSortDate(pedido);
    const total = calcularValorPedido(pedido);
    current.totalValue += total;
    current.pedidos.push({
      ...pedido,
      _billingDate: billingDate,
      _fallbackDate: fallbackDate,
      _sortDate: sortDate
    });
    if (billingDate && (!current.latestBillingDate || billingDate.getTime() > current.latestBillingDate.getTime())) current.latestBillingDate = billingDate;
    else if (!current.latestBillingDate && fallbackDate) current.latestBillingDate = fallbackDate;
    groupMap.set(groupKey, current);
  });
  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      pedidos: group.pedidos.sort((a, b) => Number(b?._sortDate?.getTime?.() || 0) - Number(a?._sortDate?.getTime?.() || 0))
    }))
    .sort((a, b) => getGroupPriority(a.key) - getGroupPriority(b.key));
}
function getFriendlyLastPurchaseLabel(value) {
  const date = asDate(value);
  if (!date) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return `Há ${diffDays} dias`;
}

function buildGoogleMapsSearchUrl(cliente = {}) {
  const latitude = Number(cliente?.latitude);
  const longitude = Number(cliente?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  const parts = (...values) => values.map((value) => String(value || '').trim()).filter(Boolean);
  const addressParts = parts(cliente?.logradouro, cliente?.numero, cliente?.complemento, cliente?.bairro, cliente?.cidade, cliente?.estado || cliente?.uf);
  const addressCoreParts = parts(cliente?.logradouro, cliente?.numero, cliente?.cidade, cliente?.estado || cliente?.uf);
  const preferredQueries = [
    parts(cliente?.nome_fantasia, cliente?.logradouro, cliente?.numero, cliente?.cidade, cliente?.estado || cliente?.uf),
    parts(cliente?.razao_social, cliente?.logradouro, cliente?.numero, cliente?.cidade, cliente?.estado || cliente?.uf),
    addressParts.length ? addressParts : addressCoreParts
  ].filter((queryParts) => queryParts.length);

  const query = preferredQueries[0];
  if (query && query.length) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.join(' '))}`;
  }

  if (hasCoordinates) {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  return null;
}

export function mapClienteDetailsData({ cliente = null, pedidos = [], clienteId, timeline = [] }) {
  const normalizedCliente = cliente && String(cliente?.id || '') === String(clienteId || '') ? cliente : null;
  const normalizedPedidos = Array.isArray(pedidos) ? pedidos : [];
  if (!normalizedCliente) return { id: null };
  const pedidosCliente = normalizedPedidos.filter((p) => belongsToCliente(p, normalizedCliente));
  const faturamentoTotal = pedidosCliente.reduce((a, p) => a + calcularValorPedido(p), 0);
  const totalPedidos = pedidosCliente.length;
  const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;
  const pedidosComData = pedidosCliente.map((p) => ({ ...p, _billingDate: getBillingDate(p), _fallbackDate: getPedidoFallbackDate(p) })).sort((a, b) => Number(b?._billingDate?.getTime() || b?._fallbackDate?.getTime() || 0) - Number(a?._billingDate?.getTime() || a?._fallbackDate?.getTime() || 0));
  const ultimosPedidos = pedidosComData.slice(0, 8).map((p) => ({ id: p?.id, numero: getPedidoCode(p), dataFaturamento: p?._billingDate || null, dataFallback: p?._fallbackDate || null, status: normalizeStatus(p?.status), valor: calcularValorPedido(p), itens: Array.isArray(p?.itens) ? p.itens : null, itemCount: Array.isArray(p?.itens) ? p.itens.length : 0 }));
  const pedidosAgrupados = buildPedidoGroups(pedidosCliente).map((group) => ({
    ...group,
    totalPedidos: group.pedidos.length,
    totalValue: group.totalValue,
    latestBillingDate: group.latestBillingDate
  }));
  const produtosMap = new Map(); pedidosCliente.forEach((p) => (Array.isArray(p?.itens) ? p.itens : []).forEach((i) => { const rawNome = String(i?.produto_nome || i?.produto?.nome || '').trim(); const nome = rawNome && !isUuidLike(rawNome) ? rawNome : 'Produto não identificado'; const q = Number(i?.quantidade ?? 0); const f = Number(i?.total ?? (Number(i?.preco_unitario ?? 0) * q)); const prev = produtosMap.get(nome) || { produto: nome, quantidade: 0, faturamento: 0 }; prev.quantidade += q; prev.faturamento += f; produtosMap.set(nome, prev); }));
  const produtosComprados = Array.from(produtosMap.values()).sort((a, b) => b.faturamento - a.faturamento);
  const statusCliente = normalizeStatus(normalizedCliente?.status) || 'Cliente';
  const dataCadastro = asDate(normalizedCliente?.created_at || normalizedCliente?.createdAt);
  const gruposComerciais = Array.isArray(normalizedCliente?.gruposComerciais)
    ? normalizedCliente.gruposComerciais.map((grupo) => ({ id: grupo.id, nome: grupo.nome, descricao: grupo.descricao || null }))
    : [];
  return {
    id: normalizedCliente?.id,
    nomeEmpresa: getClienteNome(normalizedCliente),
    status: statusCliente,
    status_raw: normalizedCliente?.status || null,
    status_editavel: normalizedCliente?.status || null,
    hasExplicitStatus: Boolean(normalizeStatus(normalizedCliente?.status)),
    cidade: normalizedCliente?.cidade || '',
    uf: normalizedCliente?.estado || normalizedCliente?.uf || '',
    dataCadastro,
    razao_social: normalizedCliente?.razao_social || null,
    nome_fantasia: normalizedCliente?.nome_fantasia || null,
    cnae_principal: normalizedCliente?.cnae_principal || null,
    situacao_cadastral: normalizedCliente?.situacao_cadastral || null,
    data_abertura: normalizedCliente?.data_abertura || null,
    cep: normalizedCliente?.cep || null,
    logradouro: normalizedCliente?.logradouro || null,
    numero: normalizedCliente?.numero || null,
    complemento: normalizedCliente?.complemento || null,
    bairro: normalizedCliente?.bairro || null,
    site: normalizedCliente?.site || normalizedCliente?.website || null,
    latitude: normalizedCliente?.latitude ?? null,
    longitude: normalizedCliente?.longitude ?? null,
    google_maps_url: normalizedCliente?.google_maps_url || null,
    google_maps_link: buildGoogleMapsSearchUrl(normalizedCliente),
    google_place_id: normalizedCliente?.google_place_id || null,
    geolocalizacao_status: normalizedCliente?.geolocalizacao_status || null,
    geolocalizacao_ultima_execucao: normalizedCliente?.geolocalizacao_ultima_execucao || null,
    geolocalizacao_fonte: normalizedCliente?.geolocalizacao_fonte || null,
    geolocalizacao_erro: normalizedCliente?.geolocalizacao_erro || null,
    cliente_score: normalizedCliente?.cliente_score ?? null,
    cliente_classificacao: normalizedCliente?.cliente_classificacao || null,
    cliente_potencial: normalizedCliente?.cliente_potencial || null,
    cliente_score_ultima_execucao: normalizedCliente?.cliente_score_ultima_execucao || null,
    cliente_score_fatores: normalizedCliente?.cliente_score_fatores || {},
    segmento_comercial: normalizedCliente?.segmento_comercial || null,
    segmento_ultima_atualizacao: normalizedCliente?.segmento_ultima_atualizacao || null,
    segmento_motivos: Array.isArray(normalizedCliente?.segmento_motivos) ? normalizedCliente.segmento_motivos : [],
    cliente_alertas: Array.isArray(normalizedCliente?.cliente_alertas) ? normalizedCliente.cliente_alertas : [],
    email_enriquecido: normalizedCliente?.email_enriquecido || null,
    telefone_enriquecido: normalizedCliente?.telefone_enriquecido || null,
    enriquecimento_status: normalizedCliente?.enriquecimento_status || null,
    enriquecimento_ultima_execucao: normalizedCliente?.enriquecimento_ultima_execucao || null,
    enriquecimento_fonte: normalizedCliente?.enriquecimento_fonte || null,
    enriquecimento_erro: normalizedCliente?.enriquecimento_erro || null,
    enriquecimento_payload: normalizedCliente?.enriquecimento_payload || {},
    dadosCliente: { empresa: normalizedCliente?.empresa, razaoSocial: normalizedCliente?.razao_social, contato: normalizedCliente?.nome_contato || normalizedCliente?.nome, telefone: normalizedCliente?.telefone, email: normalizedCliente?.email, documento: normalizedCliente?.documento || normalizedCliente?.cnpj || normalizedCliente?.cpf, cidade: normalizedCliente?.cidade, uf: normalizedCliente?.estado || normalizedCliente?.uf, status: normalizeStatus(normalizedCliente?.status), dataCadastro, vendedor: normalizedCliente?.vendedor || normalizedCliente?.responsavel_comercial || normalizedCliente?.vendedor_nome || '' },
    kpis: { faturamentoTotal, totalPedidos, ticketMedio, ultimaCompra: pedidosComData[0]?._billingDate || pedidosComData[0]?._fallbackDate || null, ultimaCompraLabel: getFriendlyLastPurchaseLabel(pedidosComData[0]?._billingDate || pedidosComData[0]?._fallbackDate || null) },
    ultimosPedidos,
    pedidosAgrupados,
    produtosComprados,
    gruposComerciais,
    crmConversations: [],
    whatsappConversations: [],
    whatsappMessagesByConversation: {},
    timeline: Array.isArray(timeline) ? timeline.map((item) => ({ ...item })) : [],
    auditoria: { criadoEm: dataCadastro, atualizadoEm: asDate(normalizedCliente?.updated_at || normalizedCliente?.updatedAt), origem: normalizedCliente?.origem || null }
  };
}
