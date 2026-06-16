function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
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

function getClientName(pedido = {}) {
  const candidates = [
    pedido?.cliente?.empresa,
    pedido?.cliente?.razao_social,
    pedido?.cliente?.nome_contato,
    pedido?.cliente?.nome,
    pedido?.cliente_nome,
    pedido?.clienteNome,
    pedido?.customerName,
    pedido?.empresa,
    pedido?.razao_social,
    pedido?.nome_contato,
    pedido?.nome
  ];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (!text || isUuidLike(text)) continue;
    if (String(pedido?.cliente_id || '').trim() === text) continue;
    return text;
  }
  return 'Cliente não identificado';
}

function getPedidoCode(pedido = {}) {
  const candidates = [pedido?.numero, pedido?.numero_pedido, pedido?.pedido_numero, pedido?.codigo, pedido?.code];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (!text || isUuidLike(text)) continue;
    return text;
  }
  return 'Pedido Comercial';
}

export function mapPedidoDetailsData(pedidoResponse = {}, historyResponse = {}) {
  const pedido = pedidoResponse?.pedido || {};
  const itens = Array.isArray(pedidoResponse?.itens) ? pedidoResponse.itens : [];
  const history = Array.isArray(historyResponse?.items) ? historyResponse.items : [];

  const total = Number(pedido?.total ?? pedido?.valor_total ?? pedido?.total_pedido ?? 0);

  const itensMapeados = itens.map((item) => {
    const quantidade = Number(item?.quantidade ?? 0);
    const valorUnitario = Number(item?.preco_unitario ?? item?.valor_unitario ?? item?.valorUnitario ?? item?.unitario ?? item?.preco ?? 0);
    const totalItem = quantidade > 0 && Number.isFinite(valorUnitario) ? quantidade * valorUnitario : 0;
    const produtoId = item?.produto_id || item?.produtoId || null;
    const produtoRaw = String(item?.produto_nome || item?.produto?.nome || '').trim();
    const produto = produtoRaw && !isUuidLike(produtoRaw) ? produtoRaw : 'Produto não identificado';
    return {
      produto,
      produto_id: produtoId,
      produtoId,
      quantidade,
      valorUnitario,
      totalItem,
      codigo_produto_erp_original: item?.codigo_produto_erp_original || null,
      nome_produto_original: item?.nome_produto_original || null,
      cor_original: item?.cor_original || null,
      tamanho_original: item?.tamanho_original || null,
      ean_original: item?.ean_original || null,
      status_vinculo: item?.status_vinculo || null,
      motivo_vinculo: item?.motivo_vinculo || null,
      sku_base_extraido: item?.sku_base_extraido || null,
      sku_esperado: item?.sku_esperado || null
    };
  });
  const quantidadeItensDistintos = itensMapeados.length;
  const quantidadeTotalVendida = itensMapeados.reduce((acc, item) => acc + Number(item?.quantidade || 0), 0);

  return {
    id: pedido?.id || null,
    idCliente: pedido?.cliente_id || null,
    numeroExibicao: getPedidoCode(pedido),
    idTecnico: pedido?.id || null,
    clienteExibicao: getClientName(pedido),
    statusExibicao: normalizeStatus(pedido?.status),
    origemExibicao: pedido?.origem || '-',
    observacoes: pedido?.observacoes || '',
    dataEmissao: pedido?.data_emissao || pedido?.dataEmissao || null,
    criadoEm: pedido?.created_at || pedido?.createdAt || null,
    atualizadoEm: pedido?.updated_at || pedido?.updatedAt || null,
    requestId: pedidoResponse?.requestId || historyResponse?.requestId || null,
    financeiro: { total },
    quantidadeItensDistintos,
    quantidadeTotalVendida,
    itens: itensMapeados,
    historico: history.map((item) => ({
      statusAnterior: normalizeStatus(item?.status_anterior),
      statusNovo: normalizeStatus(item?.status_novo),
      data: item?.created_at || item?.createdAt || null
    }))
  };
}
