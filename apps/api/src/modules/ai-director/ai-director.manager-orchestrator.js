function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSeverity(value) {
  const text = normalizeText(value).toLowerCase();
  if (['critico', 'crítico', 'alta', 'high'].includes(text)) return 'alta';
  if (['medio', 'médio', 'media', 'média', 'medium'].includes(text)) return 'media';
  return 'baixa';
}

function managerLabel(manager) {
  return normalizeText(manager?.nome || manager?.name || manager?.label || '');
}

function resolveManagerById(managerId, managers = []) {
  const id = String(managerId ?? '').trim().toLowerCase();
  if (!id) return null;
  return asArray(managers).find((manager) => String(manager?.id ?? '').trim().toLowerCase() === id) || null;
}

function resolveManagerByModule(modulo, alteracaoTipo, managers = []) {
  const moduleText = String(modulo ?? '').toLowerCase();
  const typeText = String(alteracaoTipo ?? '').toLowerCase();
  const managerOrder = [];
  if (moduleText.includes('cliente') || moduleText.includes('pedido') || moduleText.includes('comercial')) managerOrder.push('comercial');
  if (moduleText.includes('produto')) managerOrder.push('produtos');
  if (moduleText.includes('promo')) managerOrder.push('comercial', 'produtos');
  if (moduleText.includes('auditoria') || moduleText.includes('log')) managerOrder.push('auditoria');
  if (moduleText.includes('memoria') || moduleText.includes('intelig')) managerOrder.push('diretor_ia');
  if (typeText.includes('reativ') || typeText.includes('inativo') || typeText.includes('risco')) managerOrder.push('followup', 'comercial');
  if (typeText.includes('cancel') || typeText.includes('rejeit')) managerOrder.push('comercial');
  if (typeText.includes('import')) managerOrder.push('comercial');
  for (const managerId of managerOrder) {
    const found = managerId === 'diretor_ia' ? null : resolveManagerById(managerId, managers);
    if (found) return found;
  }
  return null;
}

function buildSuggestion({ modulo, alteracaoTipo, severidade, gerente, gerenteId, origemAlteracao }) {
  const type = String(alteracaoTipo ?? '').toLowerCase();
  const moduleText = String(modulo ?? '').toLowerCase();
  if (moduleText.includes('cliente') && (type.includes('import') || type.includes('novo'))) return 'Revisar segmentação dos clientes importados e validar oportunidades de ativação.';
  if (moduleText.includes('cliente') && type.includes('inativo')) return 'Acionar plano de reativação para clientes inativos recém-identificados.';
  if (moduleText.includes('pedido') && type.includes('novo')) return 'Avaliar impacto dos novos pedidos no desempenho comercial.';
  if (moduleText.includes('pedido') && (type.includes('cancel') || type.includes('rejeit'))) return 'Investigar motivo dos cancelamentos e impacto no faturamento.';
  if (moduleText.includes('produto')) return 'Revisar cadastro e impacto operacional dos produtos alterados.';
  if (moduleText.includes('promo')) return 'Avaliar aderência da promoção aos produtos e clientes-alvo.';
  if (moduleText.includes('auditoria')) return 'Priorizar correção dos eventos críticos apontados pela auditoria.';
  if (moduleText.includes('memoria') || moduleText.includes('intelig')) return 'Revisar insight crítico e registrar decisão executiva.';
  if (severidade === 'alta') return `Executar revisão prioritária sobre ${normalizeText(origemAlteracao || modulo || 'a alteração')}.`;
  return gerenteId ? `Validar a alteração em ${normalizeText(modulo || 'módulo')} com o gerente responsável.` : 'Validar impacto da alteração com o time responsável.';
}

function buildPriority(severidade) {
  if (severidade === 'alta') return 'alta';
  if (severidade === 'media') return 'media';
  return 'baixa';
}

function buildSummary(orquestracoes = []) {
  if (!orquestracoes.length) return 'Nenhuma orquestração de gerentes foi necessária na janela monitorada.';
  const principal = orquestracoes.find((item) => item.prioridade === 'alta') || orquestracoes[0];
  return `${orquestracoes.length} alterações relevantes foram associadas a gerentes. A principal atuação sugerida é do ${principal.gerente || 'gerente responsável'} para ${principal.acao.toLowerCase()}`;
}

export function orchestrateManagersForChanges(context = {}) {
  const alteracoes = asArray(context.alteracoesRelevantes || context.alteracoes);
  const managers = asArray(context.managers);
  const seen = new Set();
  const orquestracoes = [];

  for (const alteracao of alteracoes) {
    if (orquestracoes.length >= 10) break;
    const modulo = normalizeText(alteracao?.modulo || '');
    const alteracaoTipo = normalizeText(alteracao?.tipo || alteracao?.alteracaoTipo || '');
    const origemAlteracao = normalizeText(alteracao?.origemAlteracao || alteracao?.impactoNoRadar || alteracao?.descricao || '');
    const chave = `${modulo.toLowerCase()}::${alteracaoTipo.toLowerCase()}::${normalizeText(alteracao?.gerenteSugerido || '').toLowerCase()}::${normalizeText(alteracao?.acao || '').toLowerCase()}`;
    if (!modulo || !alteracaoTipo || seen.has(chave)) continue;
    seen.add(chave);

    const manager = resolveManagerByModule(modulo, alteracaoTipo, managers) || resolveManagerById(String(alteracao?.gerenteSugerido || '').trim().toLowerCase(), managers);
    const gerente = managerLabel(manager) || normalizeText(alteracao?.gerenteSugerido || '') || {
      clientes: 'Gerente Comercial',
      pedidos: 'Gerente Comercial',
      produtos: 'Gerente de Produtos',
      promocoes: 'Gerente Comercial',
      auditoria: 'Gerente de Auditoria',
      memorias: 'Diretor IA'
    }[modulo.toLowerCase()] || null;
    const gerenteId = manager?.id || null;
    const severidade = normalizeSeverity(alteracao?.severidade);
    const acao = normalizeText(alteracao?.acao || buildSuggestion({ modulo, alteracaoTipo, severidade, gerente, gerenteId, origemAlteracao }));
    const item = {
      modulo,
      alteracaoTipo,
      gerente: gerente || null,
      gerenteId,
      prioridade: buildPriority(severidade),
      acao,
      justificativa: normalizeText(alteracao?.impactoNoRadar || alteracao?.descricao || 'Alteração relevante associada ao módulo.') || 'Alteração relevante associada ao módulo.',
      status: gerenteId ? 'sugerida' : 'sem_gerente',
      origemAlteracao: origemAlteracao || modulo
    };
    const dedupeKey = `${item.modulo.toLowerCase()}::${item.alteracaoTipo.toLowerCase()}::${String(item.gerente || '').toLowerCase()}::${item.acao.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    orquestracoes.push(item);
  }

  return {
    totalOrquestracoes: orquestracoes.length,
    orquestracoes,
    resumo: buildSummary(orquestracoes)
  };
}
