import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const validTipos = new Set(['observacao', 'alerta', 'oportunidade', 'diagnostico', 'decisao', 'plano_acao']);
const validPrioridades = new Set(['baixa', 'media', 'alta', 'critica']);
const memoryStore = [];

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
