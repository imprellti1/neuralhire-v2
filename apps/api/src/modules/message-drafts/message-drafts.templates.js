export function buildReactivationTemplate() {
  return {
    draftType: 'reactivation',
    draftText: 'Olá, tudo bem?\n\nPercebi que faz algum tempo desde o último pedido e gostaria de saber como estão os estoques.\n\nPosso ajudar em alguma reposição ou necessidade atual?\n\nSecretária do Igor',
    reason: 'Cliente com longo período sem compra, com oportunidade de reativação comercial.'
  };
}

export function buildReplenishmentTemplate(context = {}) {
  const product = context.recurringProduct || 'os itens recorrentes';
  const manufacturers = Array.isArray(context.recommendedManufacturers) && context.recommendedManufacturers.length
    ? ` Os fabricantes em evidência são ${context.recommendedManufacturers.slice(0, 3).join(', ')}.`
    : '';
  return {
    draftType: 'replenishment',
    draftText: `Gostaria de verificar se há necessidade de reposição de ${product}.${manufacturers} Posso ajudar com disponibilidade, volumes e próxima entrega.`,
    reason: 'Produto recorrente com frequência alta e janela de reposição favorável.'
  };
}

export function buildUpsellTemplate(context = {}) {
  const summary = context.actionReason || 'Percebi oportunidade de ampliar o relacionamento comercial.';
  return {
    draftType: 'upsell',
    draftText: `Olá, ${summary} Se fizer sentido, posso compartilhar opções que acompanhem o crescimento do seu time e das suas demandas atuais.`,
    reason: 'Ação comercial indica crescimento de conta e espaço para ampliação de ticket.'
  };
}

export function buildCrossSellTemplate(context = {}) {
  const manufacturers = Array.isArray(context.recommendedManufacturers) && context.recommendedManufacturers.length
    ? context.recommendedManufacturers.slice(0, 3).join(', ')
    : 'novos fabricantes';
  return {
    draftType: 'cross_sell',
    draftText: `Estou revisando algumas alternativas com ${manufacturers} que podem complementar o que vocês já compram hoje. Se quiser, eu posso te mostrar as opções mais aderentes.`,
    reason: 'Há fabricantes ainda não explorados e espaço para expandir o mix.'
  };
}

export function buildFollowupTemplate() {
  return {
    draftType: 'relationship',
    draftText: 'Passando para acompanhar como foi o uso da última compra e se posso apoiar com qualquer ajuste ou nova solicitação.',
    reason: 'Há histórico recente e o próximo passo ideal é um follow-up comercial.'
  };
}

export function buildRelationshipTemplate() {
  return {
    draftType: 'relationship',
    draftText: 'Queria aproveitar para manter nosso contato atualizado e saber se podemos apoiar em algo novo por aí. Fico à disposição para ajudar.',
    reason: 'Cliente ativo, sem alertas críticos, e a melhor ação é fortalecer o relacionamento.'
  };
}

export function buildGenericTemplate() {
  return {
    draftType: 'generic',
    draftText: 'Olá, tudo bem? Estou passando para entender como estão as demandas por aí e se posso ajudar com alguma necessidade comercial.',
    reason: 'Contexto insuficiente para uma abordagem mais específica.'
  };
}

export function buildRelationshipTemplateWithAction(context = {}) {
  const reason = context.actionReason || 'Quero manter nosso contato atualizado e entender o que pode ser útil no momento.';
  return {
    draftType: 'relationship',
    draftText: `Olá, tudo bem?\n\n${reason}\n\nFico à disposição para ajudar no que fizer sentido por aí.`,
    reason: 'Cliente ativo, sem viés de venda imediata, e a melhor ação é fortalecer o relacionamento.'
  };
}

export function buildRiskRecoveryTemplate(context = {}) {
  const reason = context.actionReason || 'Percebi alguns sinais de risco e quero entender como podemos apoiar melhor.';
  return {
    draftType: 'risk_recovery',
    draftText: `Olá, tudo bem?\n\n${reason}\n\nSe houver qualquer ponto que eu possa ajudar a destravar, sigo à disposição.`,
    reason: 'Há risco comercial e a mensagem precisa focar em recuperação e reaproximação.'
  };
}
