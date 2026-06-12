const CATEGORY_BY_MANAGER = {
  comercial: 'comercial',
  produtos: 'produtos',
  auditoria: 'auditoria',
  followup: 'followup',
  administrativo: 'administrativo'
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildMemory(tipo, titulo, descricao, categoria, severidade, dados_json) {
  return { tipo, titulo, descricao, categoria, severidade, dados_json };
}

export function analyzeExecutiveFacts(managerFacts = [], previousMemories = []) {
  const insights = [];
  const previousText = previousMemories.map((memory) => [memory?.titulo, memory?.descricao, memory?.tipo].join(' ').toLowerCase()).join(' ');

  for (const manager of managerFacts) {
    const facts = manager?.facts || {};
    const category = CATEGORY_BY_MANAGER[manager.managerId] || 'geral';

    if (manager.managerId === 'comercial') {
      if (toNumber(facts.clientes_risco, 0) > 0 && !previousText.includes('clientes em risco')) {
        insights.push(buildMemory(
          'risk',
          'Aumento de clientes em risco',
          `O Diretor IA identificou ${facts.clientes_risco} cliente(s) em risco na carteira atual.`,
          category,
          facts.clientes_risco > 10 ? 'alta' : 'media',
          { clientes_risco: facts.clientes_risco, clientes_ativos: facts.clientes_ativos, receita_mes: facts.receita_mes, pedidos_mes: facts.pedidos_mes }
        ));
      }
      if (toNumber(facts.receita_mes, 0) > 0) {
        insights.push(buildMemory(
          'performance',
          'Crescimento de faturamento',
          `A receita atual registrou ${facts.receita_mes} no período analisado.`,
          category,
          'media',
          { receita_mes: facts.receita_mes, pedidos_mes: facts.pedidos_mes, ticket_medio: facts.ticket_medio }
        ));
      }
    }

    if (manager.managerId === 'produtos' && toNumber(facts.promocoes_ativas, 0) > 0) {
      insights.push(buildMemory(
        'opportunity',
        'Maior utilização de promoções',
        `Foram identificadas ${facts.promocoes_ativas} promoção(ões) ativa(s), indicando alavanca comercial disponível.`,
        category,
        facts.promocoes_ativas >= 5 ? 'alta' : 'media',
        { promocoes_ativas: facts.promocoes_ativas, fabricante_lider: facts.fabricante_lider, produtos_criticos: facts.produtos_criticos }
      ));
    }

    if (manager.managerId === 'auditoria' && toNumber(facts.issues_criticas, 0) > 0) {
      insights.push(buildMemory(
        'alert',
        'Problemas críticos identificados',
        `O monitoramento apontou ${facts.issues_criticas} issue(s) crítica(s) que merecem atenção imediata.`,
        category,
        facts.issues_criticas >= 3 ? 'critica' : 'alta',
        { issues_criticas: facts.issues_criticas, issues_abertas: facts.issues_abertas, ultimo_alerta: facts.ultimo_alerta }
      ));
    }

    if (manager.managerId === 'followup' && toNumber(facts.clientes_bloqueados, 0) > 0) {
      insights.push(buildMemory(
        'trend',
        'Aumento de bloqueios no follow-up',
        `Existem ${facts.clientes_bloqueados} bloqueio(s) em andamento no fluxo de follow-up.`,
        category,
        facts.clientes_bloqueados >= 5 ? 'alta' : 'media',
        { clientes_bloqueados: facts.clientes_bloqueados, clientes_followup: facts.clientes_followup, oportunidades_aquecendo: facts.oportunidades_aquecendo }
      ));
    }
  }

  return insights;
}
