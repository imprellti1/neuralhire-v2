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
    const indicators = facts.indicators && typeof facts.indicators === 'object' ? facts.indicators : facts;
    const managerId = String(manager?.managerId || manager?.facts?.manager_id || manager?.manager?.id || '').trim().toLowerCase();
    const category = CATEGORY_BY_MANAGER[managerId] || 'geral';

    if (managerId === 'comercial') {
      if (toNumber(indicators.clientes_risco, 0) > 0 && !previousText.includes('clientes em risco')) {
        insights.push(buildMemory(
          'risk',
          'Aumento de clientes em risco',
          `O Diretor IA identificou ${indicators.clientes_risco} cliente(s) em risco na carteira atual.`,
          category,
          indicators.clientes_risco > 10 ? 'alta' : 'media',
          { clientes_risco: indicators.clientes_risco, clientes_ativos: indicators.clientes_ativos, receita_mes: indicators.receita_mes, pedidos_mes: indicators.pedidos_mes }
        ));
      }
      if (toNumber(indicators.receita_mes, 0) > 0) {
        insights.push(buildMemory(
          'performance',
          'Crescimento de faturamento',
          `A receita atual registrou ${indicators.receita_mes} no período analisado.`,
          category,
          'media',
          { receita_mes: indicators.receita_mes, pedidos_mes: indicators.pedidos_mes, ticket_medio: indicators.ticket_medio }
        ));
      }
    }

    if (managerId === 'produtos' && toNumber(indicators.promocoes_ativas, 0) > 0) {
      insights.push(buildMemory(
        'opportunity',
        'Maior utilização de promoções',
        `Foram identificadas ${indicators.promocoes_ativas} promoção(ões) ativa(s), indicando alavanca comercial disponível.`,
        category,
        indicators.promocoes_ativas >= 5 ? 'alta' : 'media',
        { promocoes_ativas: indicators.promocoes_ativas, fabricante_lider: indicators.fabricante_lider, produtos_criticos: indicators.produtos_criticos }
      ));
    }

    if (managerId === 'auditoria' && toNumber(indicators.issues_criticas, 0) > 0) {
      insights.push(buildMemory(
        'alert',
        'Problemas críticos identificados',
        `O monitoramento apontou ${indicators.issues_criticas} issue(s) crítica(s) que merecem atenção imediata.`,
        category,
        indicators.issues_criticas >= 3 ? 'critica' : 'alta',
        { issues_criticas: indicators.issues_criticas, issues_abertas: indicators.issues_abertas, ultimo_alerta: indicators.ultimo_alerta }
      ));
    }

    if (managerId === 'followup' && toNumber(indicators.clientes_bloqueados, 0) > 0) {
      insights.push(buildMemory(
        'trend',
        'Aumento de bloqueios no follow-up',
        `Existem ${indicators.clientes_bloqueados} bloqueio(s) em andamento no fluxo de follow-up.`,
        category,
        indicators.clientes_bloqueados >= 5 ? 'alta' : 'media',
        { clientes_bloqueados: indicators.clientes_bloqueados, clientes_followup: indicators.clientes_followup, oportunidades_aquecendo: indicators.oportunidades_aquecendo }
      ));
    }
  }

  return insights;
}
