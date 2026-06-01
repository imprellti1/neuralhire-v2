function asDate(value) { const d = new Date(value || ''); return Number.isNaN(d.getTime()) ? null : d; }
function isUuidLike(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()); }
function normalizeStatus(status) { const s = String(status || '').toLowerCase(); if (s.includes('rascun')) return 'Rascunho'; if (s.includes('aprova')) return 'Aprovado'; if (s.includes('confirm')) return 'Confirmado'; if (s.includes('fatura')) return 'Faturado'; if (s.includes('cancel')) return 'Cancelado'; return ''; }
function getClienteNome(item = {}) { return item?.empresa || item?.razao_social || item?.nome || 'Cliente não identificado'; }
function getPedidoCode(item = {}) { const code = item?.numero || item?.numero_pedido || item?.pedido_numero || item?.codigo || item?.code || ''; return isUuidLike(code) ? '' : code; }
function belongsToCliente(pedido = {}, cliente = {}) { const pid = String(pedido?.cliente_id || pedido?.cliente?.id || '').trim(); const cid = String(cliente?.id || '').trim(); if (pid && cid && pid === cid) return true; const pnome = String(pedido?.cliente?.empresa || pedido?.cliente?.razao_social || pedido?.cliente_nome || pedido?.empresa || '').trim().toLowerCase(); const cnome = String(getClienteNome(cliente)).trim().toLowerCase(); return Boolean(pnome && cnome && pnome === cnome); }
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

export function mapClienteDetailsData({ clientesResponse = {}, pedidosResponse = {}, clienteId }) {
  const clientes = Array.isArray(clientesResponse?.items) ? clientesResponse.items : [];
  const pedidos = Array.isArray(pedidosResponse?.items) ? pedidosResponse.items : [];
  const cliente = clientes.find((c) => String(c?.id || '') === String(clienteId || ''));
  if (!cliente) return { id: null };
  const pedidosCliente = pedidos.filter((p) => belongsToCliente(p, cliente));
  const faturamentoTotal = pedidosCliente.reduce((a, p) => a + Number(p?.valor_total ?? p?.total ?? p?.valor ?? 0), 0);
  const totalPedidos = pedidosCliente.length;
  const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;
  const pedidosComData = pedidosCliente.map((p) => ({ ...p, _data: asDate(p?.created_at || p?.createdAt || p?.criado_em) })).sort((a, b) => Number(b?._data?.getTime() || 0) - Number(a?._data?.getTime() || 0));
  const ultimosPedidos = pedidosComData.slice(0, 8).map((p) => ({ id: p?.id, numero: getPedidoCode(p), data: p?._data, status: normalizeStatus(p?.status), valor: Number(p?.valor_total ?? p?.total ?? p?.valor ?? 0) }));
  const produtosMap = new Map(); pedidosCliente.forEach((p) => (Array.isArray(p?.itens) ? p.itens : []).forEach((i) => { const rawNome = String(i?.produto_nome || i?.produto?.nome || '').trim(); const nome = rawNome && !isUuidLike(rawNome) ? rawNome : 'Produto não identificado'; const q = Number(i?.quantidade ?? 0); const f = Number(i?.total ?? (Number(i?.preco_unitario ?? 0) * q)); const prev = produtosMap.get(nome) || { produto: nome, quantidade: 0, faturamento: 0 }; prev.quantidade += q; prev.faturamento += f; produtosMap.set(nome, prev); }));
  const produtosComprados = Array.from(produtosMap.values()).sort((a, b) => b.faturamento - a.faturamento);
  const timeline = [{ tipo: 'Cliente cadastrado', data: asDate(cliente?.created_at || cliente?.createdAt), detalhe: '' }, ...pedidosComData.flatMap((p) => { const code = getPedidoCode(p); const label = code ? `Pedido ${code}` : 'Pedido'; const base = [{ tipo: `${label} criado`, data: asDate(p?.created_at || p?.createdAt), detalhe: '' }]; const s = normalizeStatus(p?.status).toLowerCase(); if (s === 'aprovado' || s === 'confirmado' || s === 'faturado' || s === 'cancelado') base.push({ tipo: `${label} ${s}`, data: asDate(p?.updated_at || p?.updatedAt || p?.created_at), detalhe: '' }); return base; })].filter((e) => e?.data).sort((a, b) => Number(b?.data?.getTime() || 0) - Number(a?.data?.getTime() || 0));
  const statusCliente = normalizeStatus(cliente?.status) || 'Cliente';
  const dataCadastro = asDate(cliente?.created_at || cliente?.createdAt);
  return { id: cliente?.id, nomeEmpresa: getClienteNome(cliente), status: statusCliente, hasExplicitStatus: Boolean(normalizeStatus(cliente?.status)), cidade: cliente?.cidade || '', uf: cliente?.estado || cliente?.uf || '', dataCadastro, dadosCliente: { empresa: cliente?.empresa, razaoSocial: cliente?.razao_social, contato: cliente?.nome_contato || cliente?.nome, telefone: cliente?.telefone, cidade: cliente?.cidade, uf: cliente?.estado || cliente?.uf, status: normalizeStatus(cliente?.status), dataCadastro }, kpis: { faturamentoTotal, totalPedidos, ticketMedio, ultimaCompra: pedidosComData[0]?._data || null, ultimaCompraLabel: getFriendlyLastPurchaseLabel(pedidosComData[0]?._data) }, ultimosPedidos, produtosComprados, timeline, auditoria: { criadoEm: dataCadastro, atualizadoEm: asDate(cliente?.updated_at || cliente?.updatedAt), origem: cliente?.origem || null } };
}
