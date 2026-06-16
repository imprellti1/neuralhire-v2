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

export function mapClienteDetailsData({ cliente = null, pedidos = [], clienteId }) {
  const normalizedCliente = cliente && String(cliente?.id || '') === String(clienteId || '') ? cliente : null;
  const normalizedPedidos = Array.isArray(pedidos) ? pedidos : [];
  if (!normalizedCliente) return { id: null };
  const pedidosCliente = normalizedPedidos.filter((p) => belongsToCliente(p, normalizedCliente));
  const faturamentoTotal = pedidosCliente.reduce((a, p) => a + Number(p?.valor_total ?? p?.total ?? p?.valor ?? 0), 0);
  const totalPedidos = pedidosCliente.length;
  const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;
  const pedidosComData = pedidosCliente.map((p) => ({ ...p, _billingDate: getBillingDate(p), _fallbackDate: asDate(p?.data_emissao || p?.emitted_at || p?.created_at || p?.createdAt || p?.criado_em) })).sort((a, b) => Number(b?._billingDate?.getTime() || b?._fallbackDate?.getTime() || 0) - Number(a?._billingDate?.getTime() || a?._fallbackDate?.getTime() || 0));
  const ultimosPedidos = pedidosComData.slice(0, 8).map((p) => ({ id: p?.id, numero: getPedidoCode(p), dataFaturamento: p?._billingDate || null, dataFallback: p?._fallbackDate || null, status: normalizeStatus(p?.status), valor: Number(p?.valor_total ?? p?.total ?? p?.valor ?? 0), itens: Array.isArray(p?.itens) ? p.itens : null, itemCount: Array.isArray(p?.itens) ? p.itens.length : 0 }));
  const produtosMap = new Map(); pedidosCliente.forEach((p) => (Array.isArray(p?.itens) ? p.itens : []).forEach((i) => { const rawNome = String(i?.produto_nome || i?.produto?.nome || '').trim(); const nome = rawNome && !isUuidLike(rawNome) ? rawNome : 'Produto não identificado'; const q = Number(i?.quantidade ?? 0); const f = Number(i?.total ?? (Number(i?.preco_unitario ?? 0) * q)); const prev = produtosMap.get(nome) || { produto: nome, quantidade: 0, faturamento: 0 }; prev.quantidade += q; prev.faturamento += f; produtosMap.set(nome, prev); }));
  const produtosComprados = Array.from(produtosMap.values()).sort((a, b) => b.faturamento - a.faturamento);
  const statusCliente = normalizeStatus(normalizedCliente?.status) || 'Cliente';
  const dataCadastro = asDate(normalizedCliente?.created_at || normalizedCliente?.createdAt);
  return { id: normalizedCliente?.id, nomeEmpresa: getClienteNome(normalizedCliente), status: statusCliente, hasExplicitStatus: Boolean(normalizeStatus(normalizedCliente?.status)), cidade: normalizedCliente?.cidade || '', uf: normalizedCliente?.estado || normalizedCliente?.uf || '', dataCadastro, dadosCliente: { empresa: normalizedCliente?.empresa, razaoSocial: normalizedCliente?.razao_social, contato: normalizedCliente?.nome_contato || normalizedCliente?.nome, telefone: normalizedCliente?.telefone, email: normalizedCliente?.email, documento: normalizedCliente?.documento || normalizedCliente?.cnpj || normalizedCliente?.cpf, cidade: normalizedCliente?.cidade, uf: normalizedCliente?.estado || normalizedCliente?.uf, status: normalizeStatus(normalizedCliente?.status), dataCadastro, vendedor: normalizedCliente?.vendedor || normalizedCliente?.responsavel_comercial || normalizedCliente?.vendedor_nome || '' }, kpis: { faturamentoTotal, totalPedidos, ticketMedio, ultimaCompra: pedidosComData[0]?._billingDate || pedidosComData[0]?._fallbackDate || null, ultimaCompraLabel: getFriendlyLastPurchaseLabel(pedidosComData[0]?._billingDate || pedidosComData[0]?._fallbackDate || null) }, ultimosPedidos, produtosComprados, crmConversations: [], auditoria: { criadoEm: dataCadastro, atualizadoEm: asDate(normalizedCliente?.updated_at || normalizedCliente?.updatedAt), origem: normalizedCliente?.origem || null } };
}
