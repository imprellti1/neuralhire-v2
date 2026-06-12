function scoreMemory(question, memory) {
  const q = String(question || '').toLowerCase();
  const text = [memory?.titulo, memory?.conteudo, memory?.tipo, memory?.origem].join(' ').toLowerCase();
  let score = 0;
  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (text.includes(token)) score += 2;
  }
  return score;
}

function summarizeManagerResponse(response = {}) {
  return {
    managerId: response?.manager?.id || null,
    managerName: response?.manager?.nome || null,
    status: response?.status || null,
    sources: Array.isArray(response?.sources) ? response.sources : [],
    summary: response?.summary || null
  };
}

export async function buildAiDirectorContext({ question, delegation, dashboard, memories = [] }) {
  const usedMemories = [...memories]
    .map((memory) => ({ ...memory, _score: scoreMemory(question, memory) }))
    .filter((memory) => memory._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 3)
    .map(({ _score, ...memory }) => memory);

  const managerFacts = (delegation?.managerResponses || []).map(summarizeManagerResponse);
  const facts = {
    health: dashboard?.health || {},
    alerts: Array.isArray(dashboard?.alerts) ? dashboard.alerts : [],
    opportunities: Array.isArray(dashboard?.opportunities) ? dashboard.opportunities : [],
    managers: managerFacts,
    memoriesCount: usedMemories.length
  };

  const safeFallbackAnswer = `Com base nos dados disponíveis, encontrei ${facts.alerts.length} alerta(s), ${facts.opportunities.length} oportunidade(s) e consultei ${managerFacts.length} gerente(s). Posso aprofundar um recorte se você quiser.`;

  return {
    question,
    facts,
    usedMemories,
    managerFacts,
    safeFallbackAnswer,
    consultedManagers: delegation?.selectedManagers || []
  };
}
