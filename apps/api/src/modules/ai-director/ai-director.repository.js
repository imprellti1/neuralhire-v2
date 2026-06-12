import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const validTipos = new Set(['observacao', 'alerta', 'oportunidade', 'diagnostico', 'decisao', 'plano_acao']);
const validPrioridades = new Set(['baixa', 'media', 'alta', 'critica']);
const memoryStore = [];
const managers = [
  {
    id: 'comercial',
    nome: 'Gerente Comercial',
    descricao: 'Especialista em carteira, pedidos, pipeline e leitura de receita.',
    modulos: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue'],
    capacidades: ['analisar carteira de clientes', 'identificar clientes em risco', 'analisar pedidos', 'resumir pipeline comercial', 'apoiar análise de faturamento'],
    status: 'ativo'
  },
  {
    id: 'produtos',
    nome: 'Gerente Produtos',
    descricao: 'Focado em catálogo, operação de produtos e leitura de promoções.',
    modulos: ['Produtos', 'Categorias', 'Fabricantes', 'Importações', 'Promoções'],
    capacidades: ['analisar catálogo', 'identificar problemas de produtos', 'avaliar fabricantes', 'acompanhar promoções', 'apoiar importações'],
    status: 'ativo'
  },
  {
    id: 'auditoria',
    nome: 'Gerente Auditoria',
    descricao: 'Responsável por integridade, logs e sinais de risco operacional.',
    modulos: ['Auditoria', 'Logs', 'Integridade de dados'],
    capacidades: ['analisar logs', 'identificar inconsistências', 'verificar integridade de dados', 'apontar riscos operacionais'],
    status: 'ativo'
  },
  {
    id: 'followup',
    nome: 'Gerente Follow-up',
    descricao: 'Orquestra conversas, bloqueios e oportunidades de follow-up.',
    modulos: ['WhatsApp', 'Evolution', 'IA Comercial', 'Pipeline IA'],
    capacidades: ['analisar conversas', 'identificar oportunidades no WhatsApp', 'avaliar bloqueios de follow-up', 'acompanhar pipeline IA'],
    status: 'ativo'
  },
  {
    id: 'administrativo',
    nome: 'Gerente Administrativo',
    descricao: 'Cuida de governança, permissões, configurações e tenant.',
    modulos: ['Usuários', 'Permissões', 'Configurações', 'Tenant'],
    capacidades: ['revisar permissões', 'analisar configuração da conta', 'apoiar governança administrativa'],
    status: 'ativo'
  }
];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director' });
}

function mode() {
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestError(`${field} obrigatorio`);
  return text;
}

function normalizeMemoryPayload(data = {}) {
  const tipo = normalizeText(data.tipo, 'tipo');
  if (!validTipos.has(tipo)) throw new BadRequestError('tipo invalido');
  const prioridade = String(data.prioridade ?? 'media').trim();
  if (!validPrioridades.has(prioridade)) throw new BadRequestError('prioridade invalida');
  const titulo = normalizeText(data.titulo, 'titulo');
  const conteudo = normalizeText(data.conteudo, 'conteudo');
  const origem = String(data.origem ?? 'diretor_ia').trim() || 'diretor_ia';
  const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {};
  return { tipo, titulo, conteudo, prioridade, origem, metadata };
}

export function getAiDirectorDashboard() {
  return {
    health: {
      receita_mes: 124550,
      pedidos_mes: 358,
      clientes_ativos: 78,
      clientes_risco: 15
    },
    alerts: [
      {
        severity: 'high',
        title: 'Faturamento caiu 18% nos últimos 15 dias'
      }
    ],
    opportunities: [
      {
        title: '12 clientes demonstraram intenção de compra'
      }
    ]
  };
}

export function listManagers() {
  return managers.map(clone);
}

export function getManagerById(managerId) {
  const id = String(managerId ?? '').trim();
  if (!id) return null;
  return managers.find((manager) => manager.id === id) || null;
}

export function consultManager(context = {}, managerId, payload = {}) {
  assertAccountId(context?.accountId || context?.account_id || null);
  const manager = getManagerById(managerId);
  if (!manager) throw new BadRequestError('manager inexistente');
  const question = normalizeText(payload.question, 'question');
  const dashboard = getAiDirectorDashboard();
  const lowerQuestion = question.toLowerCase();
  const facts = {
    manager_id: manager.id,
    manager_nome: manager.nome,
    sources: [...manager.modulos],
    question,
    indicators: {},
    observations: []
  };

  if (managerId === 'comercial') {
    facts.indicators = {
      receita_mes: dashboard.health.receita_mes,
      pedidos_mes: dashboard.health.pedidos_mes,
      clientes_ativos: dashboard.health.clientes_ativos,
      clientes_risco: dashboard.health.clientes_risco
    };
    if (lowerQuestion.includes('faturamento') || lowerQuestion.includes('receita')) {
      facts.observations.push('A receita do mes atual esta abaixo do esperado no painel executivo.');
    }
    if (lowerQuestion.includes('risco') || lowerQuestion.includes('cliente')) {
      facts.observations.push('Ha clientes em risco que merecem priorizacao imediata.');
    }
  }

  if (managerId === 'produtos') {
    facts.indicators = {
      alertas_produto: dashboard.alerts.length,
      oportunidades: dashboard.opportunities.length
    };
    if (lowerQuestion.includes('fabricante')) {
      facts.observations.push('A analise deve priorizar fabricantes e mix de vendas.');
    }
    if (lowerQuestion.includes('promoc')) {
      facts.observations.push('As promocoes ativas precisam ser verificadas na camada de catalogo.');
    }
  }

  if (managerId === 'auditoria') {
    facts.indicators = {
      alertas_criticos: dashboard.alerts.filter((alert) => String(alert.severity || '').toLowerCase() === 'high').length
    };
    facts.observations.push('Existe sinal critico de acompanhamento operacional no painel.');
  }

  if (managerId === 'followup') {
    facts.indicators = {
      oportunidades: dashboard.opportunities.length
    };
    facts.observations.push('As oportunidades registradas precisam de follow-up comercial.');
  }

  if (managerId === 'administrativo') {
    facts.indicators = {
      alertas: dashboard.alerts.length
    };
    facts.observations.push('O foco e governanca e risco operacional.');
  }

  return {
    manager: {
      id: manager.id,
      nome: manager.nome
    },
    question,
    summary: `Consulta recebida pelo ${manager.nome}.`,
    status: 'answered',
    sources: [...manager.modulos],
    facts
  };
}

export function searchAiDirectorMemories(memories = [], question = '', limit = 3) {
  const normalizedQuestion = String(question || '').toLowerCase();
  return [...memories]
    .map((memory) => {
      const text = [memory?.titulo, memory?.conteudo, memory?.tipo, memory?.origem].join(' ').toLowerCase();
      const score = normalizedQuestion.split(/\s+/).filter(Boolean).reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
      return { ...memory, _score: score };
    })
    .filter((memory) => memory._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...memory }) => memory);
}

export async function listAiDirectorMemories(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const limit = Number(filters.limit ?? 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('ai_director_memories')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new DatabaseError('Falha ao listar memorias do diretor', { details: error });
    return { items: data || [], total: (data || []).length };
  }

  const items = memoryStore
    .filter((row) => row.account_id === accountId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, safeLimit)
    .map(clone);
  return { items, total: items.length };
}

export async function createAiDirectorMemory(data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const payload = normalizeMemoryPayload(data);
  const row = {
    id: randomUUID(),
    account_id: accountId,
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: inserted, error } = await supabase.from('ai_director_memories').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar memoria do diretor', { details: error });
    return inserted;
  }

  memoryStore.push(row);
  return clone(row);
}

export function __resetMemoryAiDirectorForTests() {
  memoryStore.length = 0;
}
