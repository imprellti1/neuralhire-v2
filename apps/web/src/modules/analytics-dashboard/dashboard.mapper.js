export function mapDashboardData(summaryRes, customersRes, productsRes, timelineRes) {
  const summary = summaryRes || {};
  const topClientes = (customersRes?.items || []).slice(0, 10).map((item) => ({
    ...item,
    nomeExibicao:
      item?.empresa
      || item?.razao_social
      || item?.nome_contato
      || item?.nome
      || item?.cliente_nome
      || item?.clienteNome
      || item?.customerName
      || '-'
  }));
  const topProdutos = (productsRes?.items || []).slice(0, 10).map((item) => ({
    ...item,
    produtoExibicao:
      item?.produto_nome
      || item?.produtoNome
      || item?.nome
      || item?.descricao
      || item?.produto
      || item?.productName
      || item?.sku
      || item?.codigo
      || '-'
  }));
  return {
    kpis: {
      faturamento: Number(summary.totalFaturado || 0),
      pedidos: Number(summary.totalPedidos || 0),
      ticketMedio: Number(summary.ticketMedio || 0),
      clientesCompradores: Number(
        summary.clientesCompradores
        || summary.totalClientesAtivos
        || summary.totalClientes
        || 0
      )
    },
    pedidosPorStatus: summary.pedidosPorStatus || {},
    topClientes,
    topProdutos,
    timeline: timelineRes?.items || []
  };
}
