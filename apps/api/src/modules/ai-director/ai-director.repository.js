import { randomUUID } from 'node:crypto';

const memoryAgents = [];
const memoryEvents = [];
const memoryRecommendations = [];

function nowIso() {
  return new Date().toISOString();
}

function ensureSeedAgents() {
  if (memoryAgents.length) return;
  const createdAt = nowIso();
  const agents = [
    {
      nome: 'Diretor IA',
      slug: 'diretor-ia',
      funcao: 'Coordena a inteligência central do NeuralHire',
      escopo: 'sistema',
      status: 'ativo',
      nivel_autonomia: 'observador'
    },
    {
      nome: 'Gerente de Produtos',
      slug: 'gerente-produtos',
      funcao: 'Observa cadastro, variações, imagens, preços e qualidade dos produtos',
      escopo: 'produtos',
      status: 'ativo',
      nivel_autonomia: 'observador'
    },
    {
      nome: 'Gerente de Promoções',
      slug: 'gerente-promocoes',
      funcao: 'Observa campanhas, vínculos de produtos, variações e validade das promoções',
      escopo: 'promocoes',
      status: 'ativo',
      nivel_autonomia: 'observador'
    },
    {
      nome: 'Gerente de Auditoria',
      slug: 'gerente-auditoria',
      funcao: 'Observa pendências, inconsistências e riscos de qualidade operacional',
      escopo: 'auditoria',
      status: 'ativo',
      nivel_autonomia: 'observador'
    },
    {
      nome: 'Gerente de Importações',
      slug: 'gerente-importacoes',
      funcao: 'Observa importações, falhas, dados pendentes e processamento de arquivos',
      escopo: 'importacoes',
      status: 'ativo',
      nivel_autonomia: 'observador'
    }
  ];
  for (const agent of agents) memoryAgents.push({ id: randomUUID(), criado_em: createdAt, atualizado_em: createdAt, ...agent });
}

function seedOverviewCounters() {
  const countersByCriticality = { baixa: 0, media: 0, alta: 0, critica: 0 };
  const countersByStatus = { novo: 0, lido: 0, arquivado: 0 };
  for (const event of memoryEvents) {
    if (countersByCriticality[event.criticidade] !== undefined) countersByCriticality[event.criticidade] += 1;
    if (countersByStatus[event.status] !== undefined) countersByStatus[event.status] += 1;
  }
  return { countersByCriticality, countersByStatus };
}

function classifyEvent(event = {}) {
  const tipo = String(event.tipo || '').toLowerCase();
  const entidade = String(event.entidade || '').toLowerCase();
  const metadata = event.metadata || {};
  if ((entidade === 'produto' || tipo.includes('produto')) && (tipo.includes('criad') || tipo.includes('edit'))) return 'baixa';
  if ((entidade === 'promocao' || tipo.includes('promocao')) && (tipo.includes('criad') || tipo.includes('edit'))) return 'media';
  if ((entidade === 'auditoria' || tipo.includes('auditoria')) && (String(metadata.prioridade || '').toLowerCase() === 'alta' || String(metadata.criticidade || '').toLowerCase() === 'alta')) return 'alta';
  if ((entidade === 'importacao' || tipo.includes('import')) && (tipo.includes('erro') || tipo.includes('falh'))) return 'alta';
  return String(event.criticidade || 'baixa').toLowerCase();
}

function buildRecommendationFromEvent(event) {
  const entidade = String(event.entidade || '').toLowerCase();
  const metadata = event.metadata || {};
  if (entidade === 'produto' && metadata.sem_imagem) {
    return {
      gerente_origem: 'Gerente de Produtos',
      titulo: 'Revisar imagem principal do produto',
      descricao: 'Gerente de Produtos recomenda revisar imagem principal antes de publicar no catálogo.',
      prioridade: 'media'
    };
  }
  if (entidade === 'promocao') {
    return {
      gerente_origem: 'Gerente de Promoções',
      titulo: 'Validar vínculos da promoção',
      descricao: 'Gerente de Promoções recomenda validar produtos e vigência antes da ativação.',
      prioridade: 'media'
    };
  }
  if (entidade === 'auditoria') {
    return {
      gerente_origem: 'Gerente de Auditoria',
      titulo: 'Tratar pendência operacional',
      descricao: 'Gerente de Auditoria recomenda tratar a pendência antes de seguir o fluxo normal.',
      prioridade: 'alta'
    };
  }
  if (entidade === 'importacao') {
    return {
      gerente_origem: 'Gerente de Importações',
      titulo: 'Corrigir falha de importação',
      descricao: 'Gerente de Importações recomenda revisar o arquivo e repetir o processamento.',
      prioridade: 'alta'
    };
  }
  return null;
}

export function getAiDirectorRepositoryMode() {
  return { mode: 'memory', persistence: 'prepared-for-supabase' };
}

export function listAiDirectorAgents() {
  ensureSeedAgents();
  return memoryAgents.map((item) => ({ ...item }));
}

export function listAiDirectorEvents() {
  return [...memoryEvents].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}

export function listAiDirectorRecommendations() {
  return [...memoryRecommendations].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}

export function getAiDirectorOverview() {
  ensureSeedAgents();
  const events = listAiDirectorEvents();
  const recommendations = listAiDirectorRecommendations().filter((item) => item.status === 'pendente');
  const { countersByCriticality, countersByStatus } = seedOverviewCounters();
  return {
    gerentes: listAiDirectorAgents(),
    eventosRecentes: events.slice(0, 10),
    recomendacoesPendentes: recommendations,
    contadoresPorCriticidade: countersByCriticality,
    contadoresPorStatus: countersByStatus
  };
}

export function createAiDirectorEvent(data = {}) {
  ensureSeedAgents();
  const event = {
    id: randomUUID(),
    tipo: String(data.tipo || 'evento').trim() || 'evento',
    origem: String(data.origem || 'sistema').trim() || 'sistema',
    entidade: String(data.entidade || 'sistema').trim() || 'sistema',
    entidade_id: data.entidade_id ?? data.entidadeId ?? null,
    titulo: String(data.titulo || '').trim() || 'Evento do Diretor IA',
    resumo: String(data.resumo || '').trim() || 'Evento registrado pelo Diretor IA.',
    criticidade: classifyEvent(data),
    status: 'novo',
    metadata: data.metadata || {},
    criado_em: nowIso()
  };
  memoryEvents.unshift(event);
  const recommendationSeed = buildRecommendationFromEvent({ ...data, ...event });
  if (recommendationSeed) {
    memoryRecommendations.unshift({
      id: randomUUID(),
      evento_id: event.id,
      gerente_origem: recommendationSeed.gerente_origem,
      titulo: recommendationSeed.titulo,
      descricao: recommendationSeed.descricao,
      prioridade: recommendationSeed.prioridade,
      status: 'pendente',
      metadata: { origem_evento: event.entidade, ...event.metadata },
      criado_em: nowIso()
    });
  }
  return { ...event };
}

export function markAiDirectorEventRead(id) {
  const event = memoryEvents.find((item) => String(item.id) === String(id));
  if (!event) return null;
  event.status = 'lido';
  return { ...event };
}

export function archiveAiDirectorEvent(id) {
  const event = memoryEvents.find((item) => String(item.id) === String(id));
  if (!event) return null;
  event.status = 'arquivado';
  return { ...event };
}

export function __resetAiDirectorMemoryForTests() {
  memoryAgents.length = 0;
  memoryEvents.length = 0;
  memoryRecommendations.length = 0;
}
