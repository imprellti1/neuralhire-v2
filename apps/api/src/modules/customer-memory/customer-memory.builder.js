import { getClienteById } from '../clientes/clientes.repository.js';
import { listPedidos } from '../pedidos/pedidos.repository.js';
import { listProdutos } from '../produtos/produtos.repository.js';
import { scoreCustomerMemory } from './customer-memory.scoring.js';

function daysSince(dateValue) {
  if (!dateValue) return 9999;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 9999;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export async function buildCustomerMemory(clienteId, options = {}) {
  const accountId = options.accountId || null;
  const cliente = await getClienteById(clienteId, { accountId, context: options.context });
  const pedidosResponse = await listPedidos({ limit: 500 }, { accountId, context: options.context });
  const pedidos = (pedidosResponse?.items || []).filter((pedido) => pedido.cliente_id === clienteId);
  const produtosResponse = await listProdutos({ limit: 500 }, { accountId, context: options.context });
  const produtosById = new Map((produtosResponse?.items || []).map((produto) => [produto.id, produto]));

  const totalPedidos = pedidos.length;
  const totalComprado = Math.round(pedidos.reduce((sum, pedido) => sum + Number(pedido.total || 0), 0) * 100) / 100;
  const ticketMedio = totalPedidos > 0 ? Math.round((totalComprado / totalPedidos) * 100) / 100 : 0;
  const lastPedido = [...pedidos].sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0))[0] || null;
  const ultimaCompra = lastPedido?.created_at || lastPedido?.createdAt || null;
  const diasSemCompra = daysSince(ultimaCompra);

  const productCounts = new Map();
  const manufacturerCounts = new Map();
  for (const pedido of pedidos) {
    for (const item of Array.isArray(pedido.itens) ? pedido.itens : []) {
      const produto = produtosById.get(item.produto_id);
      const productName = produto?.nome || item.produto_nome || item.produto_id || 'desconhecido';
      productCounts.set(productName, (productCounts.get(productName) || 0) + Number(item.quantidade || 0));
      const fabricante = produto?.fabricante_nome || produto?.marca || produto?.fabricante || null;
      if (fabricante) manufacturerCounts.set(fabricante, (manufacturerCounts.get(fabricante) || 0) + Number(item.quantidade || 0));
    }
  }

  const maisComprados = [...productCounts.entries()].map(([nome, quantidade]) => ({ nome, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
  const favoritos = [...manufacturerCounts.entries()].map(([nome, quantidade]) => ({ nome, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
  const scores = scoreCustomerMemory({ commercial: { diasSemCompra, totalPedidos, totalComprado, ticketMedio } });

  const opportunities = [];
  if (diasSemCompra > 120) opportunities.push({ type: 'replenishment', title: 'Reposicao em atraso', description: 'Cliente sem compra ha mais de 120 dias.' });
  if (scores.frequenciaCompra === 'alta') opportunities.push({ type: 'upsell', title: 'Cliente recorrente', description: 'Aproveitar recorrencia para aumento de ticket.' });
  if (favoritos[0]) opportunities.push({ type: 'manufacturer_focus', title: 'Fabricante dominante', description: `Aderencia forte em ${favoritos[0].nome}.` });
  if (maisComprados[0]) opportunities.push({ type: 'reorder', title: 'Produto recorrente', description: `Reforcar reposicao de ${maisComprados[0].nome}.` });

  const alerts = [];
  if (scores.risk === 'alto') alerts.push({ type: 'risk', title: 'Risco alto', description: 'Cliente com alta chance de evasao comercial.' });
  if (diasSemCompra > 90) alerts.push({ type: 'stale', title: 'Sem pedidos recentes', description: `Ha ${diasSemCompra} dias sem compra.` });
  if (ticketMedio < 1000 && totalPedidos > 0) alerts.push({ type: 'ticket', title: 'Ticket abaixo do esperado', description: 'Ticket medio pode estar caindo.' });

  const summary = [
    scores.frequenciaCompra === 'alta' ? 'Cliente recorrente' : 'Cliente com baixa recorrencia',
    favoritos[0] ? `com forte historico em ${favoritos[0].nome}` : 'sem fabricante dominante',
    `esta ha ${diasSemCompra} dias sem comprar`,
    `e apresenta risco ${scores.risk} de perda.`
  ].join(' ');

  return {
    clienteId,
    profile: {
      nome: cliente.nome || cliente.empresa || cliente.razao_social || '',
      empresa: cliente.empresa || cliente.razao_social || cliente.nome || '',
      cidade: cliente.cidade || '',
      uf: cliente.uf || cliente.estado || ''
    },
    commercial: {
      totalPedidos,
      totalComprado,
      ticketMedio,
      ultimaCompra,
      diasSemCompra
    },
    behavior: {
      frequenciaCompra: scores.frequenciaCompra,
      risco: scores.risk,
      potencial: scores.potencial
    },
    products: {
      maisComprados,
      recorrentes: maisComprados.map((entry) => entry.nome)
    },
    manufacturers: {
      favoritos
    },
    opportunities,
    alerts,
    summary
  };
}
