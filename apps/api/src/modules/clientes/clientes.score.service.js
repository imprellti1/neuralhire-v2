function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundScore(value) {
  return Math.max(0, Math.min(100, Math.round(safeNumber(value))));
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPedidoStatus(pedido = {}) {
  return String(pedido?.status || pedido?.metadata?.status || pedido?.metadata?.situacao || '').trim().toLowerCase();
}

function isPedidoValido(pedido = {}) {
  const status = getPedidoStatus(pedido);
  if (!status) return false;
  return !['cancelado', 'rejeitado', 'estornado'].includes(status);
}

function getPedidoValor(pedido = {}) {
  const valorPedido = safeNumber(pedido?.valor_total ?? pedido?.valor ?? pedido?.total);
  if (valorPedido > 0) return valorPedido;
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  return itens.reduce((acc, item) => {
    const total = safeNumber(item?.valor_total ?? item?.total);
    if (total > 0) return acc + total;
    return acc + safeNumber(item?.quantidade) * safeNumber(item?.valor_unitario ?? item?.preco_unitario ?? item?.preco);
  }, 0);
}

function getPedidoData(pedido = {}) {
  return normalizeDate(pedido?.data_faturamento || pedido?.data_emissao || pedido?.created_at || pedido?.createdAt);
}

function getItemProdutoKey(item = {}) {
  return String(item?.produto_id || item?.produto?.id || item?.produto_nome || item?.nome_produto_original || item?.descricao || '').trim();
}

function computeFactorScore(value, thresholds, maxScore) {
  const ordered = Array.isArray(thresholds) ? thresholds : [];
  for (const [limit, score] of ordered) {
    if (value <= limit) return score;
  }
  return maxScore;
}

export function calcularScoreCliente({ cliente = {}, pedidos = [], itens = [] } = {}) {
  const pedidosValidos = (Array.isArray(pedidos) ? pedidos : []).filter(isPedidoValido);
  const itensValidos = Array.isArray(itens) ? itens : [];
  const faturamentoTotal = pedidosValidos.reduce((acc, pedido) => acc + getPedidoValor(pedido), 0);
  const totalPedidos = pedidosValidos.length;
  const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;
  const datasPedidos = pedidosValidos.map(getPedidoData).filter(Boolean).sort((a, b) => b.getTime() - a.getTime());
  const ultimaCompra = datasPedidos[0] || null;
  const hoje = new Date();
  const diasSemCompra = ultimaCompra ? Math.max(0, Math.floor((hoje.getTime() - ultimaCompra.getTime()) / 86400000)) : null;
  const produtosDistintos = new Set(
    itensValidos
      .filter((item) => pedidosValidos.some((pedido) => String(pedido?.id || '') === String(item?.pedido_id || item?.pedidoId || '')))
      .map(getItemProdutoKey)
      .filter(Boolean)
  ).size;

  const scoreFaturamento = faturamentoTotal <= 0 ? 0 : computeFactorScore(faturamentoTotal, [
    [1000, 6],
    [5000, 12],
    [20000, 20],
    [50000, 26]
  ], 30);
  const scoreFrequencia = totalPedidos <= 0 ? 0 : computeFactorScore(totalPedidos, [
    [1, 5],
    [3, 10],
    [5, 15],
    [10, 20]
  ], 25);
  const scoreTicket = ticketMedio <= 0 ? 0 : computeFactorScore(ticketMedio, [
    [200, 4],
    [500, 8],
    [1000, 12],
    [2500, 15]
  ], 15);
  const scoreRecencia = diasSemCompra === null ? 0 : computeFactorScore(diasSemCompra, [
    [30, 20],
    [60, 16],
    [120, 10],
    [180, 5]
  ], 20);
  const scoreDiversidade = produtosDistintos <= 0 ? 0 : computeFactorScore(produtosDistintos, [
    [1, 2],
    [3, 5],
    [5, 8],
    [10, 10]
  ], 10);

  const score = roundScore(scoreFaturamento + scoreFrequencia + scoreTicket + scoreRecencia + scoreDiversidade);
  const classificacao = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  const potencial = classificacao === 'A' ? 'Alto' : classificacao === 'D' ? 'Baixo' : 'Médio';

  return {
    score,
    classificacao,
    potencial,
    fatores: {
      faturamento_total: faturamentoTotal,
      total_pedidos: totalPedidos,
      ticket_medio: ticketMedio,
      ultima_compra: ultimaCompra ? ultimaCompra.toISOString() : null,
      dias_sem_compra: diasSemCompra,
      produtos_distintos: produtosDistintos,
      score_faturamento: scoreFaturamento,
      score_frequencia: scoreFrequencia,
      score_ticket_medio: scoreTicket,
      score_recencia: scoreRecencia,
      score_diversidade: scoreDiversidade
    }
  };
}
