import { listClientes } from '../clientes/clientes.repository.js';
import { listPedidos } from '../pedidos/pedidos.repository.js';
import { listProdutos } from '../produtos/produtos.repository.js';
import { listPromocoes } from '../promocoes/promocoes.repository.js';
import { listAuditLogs } from '../audit-logs/audit-logs.repository.js';
import { listExecutiveMemories } from './ai-director.repository.js';

const DEFAULT_WINDOW_HOURS = 24;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function withinWindow(value, since) {
  const date = toDate(value);
  return date ? date.getTime() >= since.getTime() : false;
}

function getTimestamp(item, keys) {
  for (const key of keys) {
    if (item?.[key]) return item[key];
  }
  return null;
}

function managerFor(modulo) {
  if (modulo === 'produtos') return 'Gerente de Produtos';
  if (modulo === 'auditoria') return 'Gerente de Auditoria';
  if (modulo === 'memorias') return 'Diretor IA';
  return 'Gerente Comercial';
}

function buildChange(change) {
  return change;
}

function addAggregatedChange(changes, { modulo, tipo, titulo, descricao, severidade, ocorridoEm, gerenteSugerido, impactoNoRadar }) {
  changes.push(buildChange({ modulo, tipo, titulo, descricao, severidade, ocorridoEm, gerenteSugerido, impactoNoRadar }));
}

function severityForCount(count, highThreshold = 50) {
  if (count >= highThreshold) return 'alta';
  if (count >= 5) return 'media';
  return 'baixa';
}

async function safeLoad(loader) {
  try {
    return await loader();
  } catch (error) {
    return { items: [], error: error?.message || 'indisponivel' };
  }
}

export async function detectRelevantChanges(context = {}) {
  const accountId = context?.accountId || context?.account_id || null;
  const janelaHoras = Number.isFinite(Number(context?.janelaHoras)) && Number(context.janelaHoras) > 0 ? Number(context.janelaHoras) : DEFAULT_WINDOW_HOURS;
  const since = new Date(Date.now() - janelaHoras * 60 * 60 * 1000);
  const fontesIndisponiveis = [];

  const [clientes, produtos, pedidos, promocoes, logs, memorias] = await Promise.all([
    safeLoad(() => listClientes({ limit: 200 }, { accountId, context })),
    safeLoad(() => listProdutos({ limit: 200 }, { accountId })),
    safeLoad(() => listPedidos({ limit: 200 }, { accountId })),
    safeLoad(() => listPromocoes({}, { accountId })),
    safeLoad(() => listAuditLogs({ limit: 50 }, { accountId })),
    safeLoad(() => listExecutiveMemories({ limit: 50 }, { accountId }))
  ]);

  if (clientes.error) fontesIndisponiveis.push('clientes');
  if (produtos.error) fontesIndisponiveis.push('produtos');
  if (pedidos.error) fontesIndisponiveis.push('pedidos');
  if (promocoes.error) fontesIndisponiveis.push('promocoes');
  if (logs.error) fontesIndisponiveis.push('auditoria');
  if (memorias.error) fontesIndisponiveis.push('memorias');

  const changes = [];

  const recentClientes = asArray(clientes.items).filter((item) => withinWindow(getTimestamp(item, ['created_at', 'createdAt', 'updated_at', 'updatedAt']), since));
  if (recentClientes.length) {
    addAggregatedChange(changes, {
      modulo: 'clientes',
      tipo: 'novo_registro',
      titulo: recentClientes.length >= 50 ? `${recentClientes.length} clientes importados recentemente` : `${recentClientes.length} cliente(s) recente(s)`,
      descricao: recentClientes.length >= 50
        ? 'Foram detectados novos clientes criados em volume elevado na janela monitorada.'
        : 'Foram detectados clientes criados ou atualizados recentemente.',
      severidade: severityForCount(recentClientes.length, 50),
      ocorridoEm: getTimestamp(recentClientes[0], ['created_at', 'createdAt', 'updated_at', 'updatedAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('clientes'),
      impactoNoRadar: 'Pode alterar carteira, risco comercial e oportunidades de follow-up.'
    });
  }

  const recentClienteUpdates = asArray(clientes.items).filter((item) => withinWindow(getTimestamp(item, ['updated_at', 'updatedAt']), since));
  if (recentClienteUpdates.length >= 5) {
    addAggregatedChange(changes, {
      modulo: 'clientes',
      tipo: 'atualizacao',
      titulo: `${recentClienteUpdates.length} clientes atualizados recentemente`,
      descricao: 'Há volume relevante de alterações na base de clientes.',
      severidade: severityForCount(recentClienteUpdates.length, 25),
      ocorridoEm: getTimestamp(recentClienteUpdates[0], ['updated_at', 'updatedAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('clientes'),
      impactoNoRadar: 'Pode sinalizar revisão de carteira ou importação operacional.'
    });
  }

  const recentProdutos = asArray(produtos.items).filter((item) => withinWindow(getTimestamp(item, ['created_at', 'createdAt', 'updated_at', 'updatedAt']), since));
  if (recentProdutos.length) {
    addAggregatedChange(changes, {
      modulo: 'produtos',
      tipo: 'catalogo_atualizado',
      titulo: `${recentProdutos.length} produto(s) recente(s)`,
      descricao: 'Produtos foram criados ou atualizados na janela monitorada.',
      severidade: severityForCount(recentProdutos.length, 20),
      ocorridoEm: getTimestamp(recentProdutos[0], ['created_at', 'createdAt', 'updated_at', 'updatedAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('produtos'),
      impactoNoRadar: 'Pode alterar catálogo, giro e leitura operacional do portfólio.'
    });
  }

  const recentPedidos = asArray(pedidos.items).filter((item) => withinWindow(getTimestamp(item, ['created_at', 'createdAt', 'updated_at', 'updatedAt']), since));
  if (recentPedidos.length) {
    addAggregatedChange(changes, {
      modulo: 'pedidos',
      tipo: 'novo_pedido',
      titulo: `${recentPedidos.length} pedido(s) recente(s)`,
      descricao: 'Pedidos foram criados recentemente na janela observada.',
      severidade: severityForCount(recentPedidos.length, 20),
      ocorridoEm: getTimestamp(recentPedidos[0], ['created_at', 'createdAt', 'updated_at', 'updatedAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('clientes'),
      impactoNoRadar: 'Pode impactar receita, conversão e acompanhamento comercial.'
    });
  }

  const canceledOrders = asArray(pedidos.items).filter((item) => {
    const status = String(item?.status || '').toLowerCase();
    return ['cancelado', 'rejeitado', 'recusado'].includes(status) && withinWindow(getTimestamp(item, ['updated_at', 'updatedAt', 'created_at', 'createdAt']), since);
  });
  if (canceledOrders.length) {
    addAggregatedChange(changes, {
      modulo: 'pedidos',
      tipo: 'cancelamento',
      titulo: `${canceledOrders.length} pedido(s) cancelado(s) ou rejeitado(s)`,
      descricao: 'Pedidos com status negativo foram observados recentemente.',
      severidade: canceledOrders.length >= 5 ? 'alta' : 'media',
      ocorridoEm: getTimestamp(canceledOrders[0], ['updated_at', 'updatedAt', 'created_at', 'createdAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('clientes'),
      impactoNoRadar: 'Pode reduzir receita e exigir ação comercial imediata.'
    });
  }

  const recentPromotions = asArray(promocoes.items).filter((item) => withinWindow(getTimestamp(item, ['created_at', 'createdAt', 'updated_at', 'updatedAt']), since));
  if (recentPromotions.length) {
    addAggregatedChange(changes, {
      modulo: 'promocoes',
      tipo: 'promocao_alterada',
      titulo: `${recentPromotions.length} promoção(ões) recente(s)`,
      descricao: 'Promoções foram criadas ou alteradas recentemente.',
      severidade: severityForCount(recentPromotions.length, 10),
      ocorridoEm: getTimestamp(recentPromotions[0], ['created_at', 'createdAt', 'updated_at', 'updatedAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('clientes'),
      impactoNoRadar: 'Pode alterar margem, giro e abordagem comercial.'
    });
  }

  const expiringPromotions = asArray(promocoes.items).filter((item) => {
    const end = toDate(item?.data_fim);
    return end && end.getTime() >= since.getTime() && end.getTime() <= Date.now();
  });
  if (expiringPromotions.length) {
    addAggregatedChange(changes, {
      modulo: 'promocoes',
      tipo: 'promocao_expirada',
      titulo: `${expiringPromotions.length} promoção(ões) expirando ou recém-expiradas`,
      descricao: 'Há promoções na borda de expiração.',
      severidade: 'media',
      ocorridoEm: getTimestamp(expiringPromotions[0], ['data_fim', 'updated_at', 'updatedAt', 'created_at', 'createdAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('clientes'),
      impactoNoRadar: 'Pode reduzir conversão e exigir revisão comercial.'
    });
  }

  const criticalMemories = asArray(memorias.items).filter((item) => ['alta', 'critica', 'crítica'].includes(String(item?.severidade || '').toLowerCase()) && withinWindow(getTimestamp(item, ['criado_em', 'created_at', 'createdAt']), since));
  if (criticalMemories.length) {
    addAggregatedChange(changes, {
      modulo: 'memorias',
      tipo: 'memoria_critica',
      titulo: `${criticalMemories.length} memória(s) crítica(s) recente(s)`,
      descricao: 'Memórias executivas relevantes foram registradas recentemente.',
      severidade: 'alta',
      ocorridoEm: getTimestamp(criticalMemories[0], ['criado_em', 'created_at', 'createdAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('memorias'),
      impactoNoRadar: 'Indica necessidade de resposta estratégica imediata.'
    });
  }

  const criticalLogs = asArray(logs.items).filter((item) => ['failed', 'critical', 'critico', 'crítico'].includes(String(item?.status || item?.severidade || '').toLowerCase()) && withinWindow(getTimestamp(item, ['created_at', 'createdAt']), since));
  if (criticalLogs.length) {
    addAggregatedChange(changes, {
      modulo: 'auditoria',
      tipo: 'log_critico',
      titulo: `${criticalLogs.length} log(s) crítico(s) recente(s)`,
      descricao: 'Foram detectados logs com severidade crítica.',
      severidade: 'alta',
      ocorridoEm: getTimestamp(criticalLogs[0], ['created_at', 'createdAt']) || new Date().toISOString(),
      gerenteSugerido: managerFor('auditoria'),
      impactoNoRadar: 'Pode indicar falha operacional ou risco de integridade.'
    });
  }

  const alteracoes = [...new Map(changes.map((item) => [`${item.modulo}::${item.tipo}::${item.titulo}`.toLowerCase(), item])).values()].sort((a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime()).slice(0, 10);
  const resumo = alteracoes.length
    ? `Foram detectadas ${alteracoes.length} alterações relevantes desde a última observação.${alteracoes[0] ? ` O principal impacto está em ${alteracoes[0].modulo}.` : ''}`
    : 'Nenhuma alteração relevante detectada na janela monitorada.';

  return {
    janelaHoras,
    geradoEm: new Date().toISOString(),
    alteracoes,
    resumo,
    fontesIndisponiveis
  };
}
