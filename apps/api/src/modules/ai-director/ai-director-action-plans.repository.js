import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { listExecutiveMemories } from './ai-director.repository.js';
import { createAiDirectorEvent } from './ai-director-events.repository.js';

const validStatus = new Set(['aberto', 'em_andamento', 'concluido', 'cancelado']);
const memoryStore = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-action-plans' });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestError(`${field} obrigatorio`);
  return text;
}

function normalizePayload(data = {}) {
  const status = String(data.status ?? 'aberto').trim();
  if (!validStatus.has(status)) throw new BadRequestError('status invalido');
  return {
    executive_memory_id: normalizeText(data.executive_memory_id, 'executive_memory_id'),
    titulo: normalizeText(data.titulo, 'titulo'),
    descricao: normalizeText(data.descricao, 'descricao'),
    gerente_responsavel: normalizeText(data.gerente_responsavel, 'gerente_responsavel'),
    impacto: normalizeText(data.impacto, 'impacto'),
    esforco: normalizeText(data.esforco, 'esforco'),
    prioridade_score: Number.isFinite(Number(data.prioridade_score)) ? Number(data.prioridade_score) : 0,
    prazo_dias: data.prazo_dias === null || data.prazo_dias === undefined || data.prazo_dias === '' ? null : Number(data.prazo_dias),
    status,
    metadata: data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {}
  };
}

function mode() {
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

function normalizeActionPlanTitleKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function buildExecutiveActionPlan(memory = {}) {
  const categories = new Set([
    String(memory?.categoria || '').toLowerCase(),
    ...(Array.isArray(memory?.metadata?.categories) ? memory.metadata.categories.map((item) => String(item || '').toLowerCase()) : [])
  ]);
  const severity = String(memory?.severidade || '').toLowerCase();
  const score = Number(memory?.metadata?.score ?? 0) || 0;
  const title = String(memory?.titulo || '').trim();
  const lowerTitle = title.toLowerCase();
  const sourceTitle = title || 'memória executiva';

  const gerenteResponsavel = categories.has('produtos') ? 'gerente_produtos'
    : categories.has('comercial') ? 'gerente_comercial'
    : categories.has('auditoria') ? 'gerente_auditoria'
    : categories.has('administrativo') ? 'gerente_administrativo'
    : 'diretor_ia';

  const impacto = ['critica', 'crítica', 'critical', 'alta', 'high'].includes(severity)
    ? 'alto'
    : ['media', 'média', 'medium'].includes(severity)
      ? 'medio'
      : ['baixa', 'low'].includes(severity)
        ? 'baixo'
        : score >= 100 ? 'alto' : score >= 50 ? 'medio' : 'baixo';

  const esforco = categories.has('produtos') ? 'medio'
    : categories.has('comercial') ? 'baixo'
    : categories.has('auditoria') ? 'medio'
    : categories.has('administrativo') ? 'baixo'
    : 'medio';

  const prazo_dias = impacto === 'alto' ? 3 : impacto === 'medio' ? 7 : 15;
  const titulo = lowerTitle.startsWith('pendências críticas de produtos')
    ? 'Regularizar pendências críticas de produtos'
    : lowerTitle.startsWith('pendências administrativas de cadastro')
      ? 'Regularizar pendências administrativas de cadastro'
      : `Executar plano de ação: ${sourceTitle}`;
  const normalizedTitleKey = normalizeActionPlanTitleKey(titulo || sourceTitle);

  const descricao = `Plano de ação gerado pelo Diretor IA a partir da memória executiva '${sourceTitle}'. O gerente responsável deve atuar sobre as pendências consolidadas, priorizando os itens de maior impacto. Prazo recomendado: ${prazo_dias} dias. Impacto estimado: ${impacto}. Motivo: ${String(memory?.descricao || 'sem descrição adicional').trim()}. Recomendação objetiva: tratar as pendências de forma determinística e registrar a evolução no acompanhamento executivo.`;

  return {
    id: randomUUID(),
    account_id: memory.account_id || null,
    executive_memory_id: memory.id,
    titulo,
    descricao,
    gerente_responsavel: gerenteResponsavel,
    impacto,
    esforco,
    prioridade_score: Number(memory?.metadata?.score ?? 0) || 0,
    prazo_dias,
    status: 'aberto',
    metadata: {
      generated_by: 'diretor_plano_acao',
      executive_memory_id: memory.id,
      normalized_title_key: normalizedTitleKey,
      source_memory_title: memory.titulo || null,
      source_memory_category: memory.categoria || null,
      source_memory_severity: memory.severidade || null,
      source_memory_metadata: memory.metadata || {},
      criteria_version: 1
    }
  };
}

export async function listOpenExecutiveMemories(accountId, options = {}) {
  assertAccountId(accountId);
  const limit = Number(options.limit ?? 50);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('ai_director_executive_memories')
      .select('*')
      .eq('account_id', accountId)
      .order('criado_em', { ascending: false })
      .limit(safeLimit);
    if (error) throw new DatabaseError('Falha ao listar memorias executivas abertas', { details: error });
    const { data: plans, error: plansError } = await supabase
      .from('ai_director_action_plans')
      .select('executive_memory_id, status')
      .eq('account_id', accountId)
      .eq('status', 'aberto');
    if (plansError) throw new DatabaseError('Falha ao consultar planos de acao', { details: plansError });
    const blocked = new Set((plans || []).map((item) => String(item.executive_memory_id || '').trim()).filter(Boolean));
    const items = (data || []).filter((item) => !blocked.has(String(item.id || '').trim()));
    return { items, total: items.length };
  }
  const [memories, plans] = await Promise.all([
    listExecutiveMemories({ limit: safeLimit }, { accountId }),
    listActionPlans(accountId, { status: 'aberto' }, { limit: 200 })
  ]);
  const openPlans = new Set((plans.items || []).map((plan) => String(plan.executive_memory_id || '').trim()).filter(Boolean));
  const items = (memories.items || []).filter((item) => !openPlans.has(String(item.id || '').trim())).slice(0, safeLimit).map(clone);
  return { items, total: items.length };
}

export async function upsertActionPlan(payload = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const normalized = normalizePayload(payload);
  const normalizedTitleKey = String(normalized.metadata?.normalized_title_key || '').trim() || normalizeActionPlanTitleKey(normalized.titulo);
  const normalizedExecutiveMemoryId = String(normalized.executive_memory_id || '').trim();
  const row = { id: randomUUID(), account_id: accountId, ...normalized, updated_at: new Date().toISOString(), criado_em: new Date().toISOString() };
  row.metadata = { ...row.metadata, normalized_title_key: normalizedTitleKey };
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: openPlans, error: selectError } = await supabase
      .from('ai_director_action_plans')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'aberto');
    if (selectError) throw new DatabaseError('Falha ao consultar plano de acao', { details: selectError });
    const current = (openPlans || []).find((item) =>
      String(item.executive_memory_id || '').trim() === normalizedExecutiveMemoryId ||
      String(item.metadata?.normalized_title_key || '').trim() === normalizedTitleKey
    ) || null;
    if (current) {
      const { data, error } = await supabase.from('ai_director_action_plans').update({ ...row, id: current.id, account_id: current.account_id, criado_em: current.criado_em }).eq('id', current.id).select('*').single();
      if (error) throw new DatabaseError('Falha ao atualizar plano de acao', { details: error });
      await createAiDirectorEvent({
        event_type: 'action_plan_created',
        entity_type: 'plano_acao',
        entity_id: data.id,
        status: 'aberto',
        title: data.titulo,
        description: data.descricao,
        recurrence_count: 0,
        metadata: { action_plan_id: data.id, executive_memory_id: data.executive_memory_id, gerente_responsavel: data.gerente_responsavel }
      }, { accountId });
      return data;
    }
    const { data, error } = await supabase.from('ai_director_action_plans').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar plano de acao', { details: error });
    await createAiDirectorEvent({
      event_type: 'action_plan_created',
      entity_type: 'plano_acao',
      entity_id: data.id,
      status: 'aberto',
      title: data.titulo,
      description: data.descricao,
      recurrence_count: 0,
      metadata: { action_plan_id: data.id, executive_memory_id: data.executive_memory_id, gerente_responsavel: data.gerente_responsavel }
    }, { accountId });
    return data;
  }
  const current = memoryStore.find((item) => item.account_id === accountId && item.status === 'aberto' && (
    String(item.executive_memory_id || '').trim() === normalizedExecutiveMemoryId ||
    String(item.metadata?.normalized_title_key || '').trim() === normalizedTitleKey
  )) || null;
  if (current) {
    Object.assign(current, row, { id: current.id, criado_em: current.criado_em });
    void createAiDirectorEvent({
      event_type: 'action_plan_created',
      entity_type: 'plano_acao',
      entity_id: current.id,
      status: 'aberto',
      title: current.titulo,
      description: current.descricao,
      recurrence_count: 0,
      metadata: { action_plan_id: current.id, executive_memory_id: current.executive_memory_id, gerente_responsavel: current.gerente_responsavel }
    }, { accountId }).catch(() => {});
    return clone(current);
  }
  memoryStore.push(row);
  void createAiDirectorEvent({
    event_type: 'action_plan_created',
    entity_type: 'plano_acao',
    entity_id: row.id,
    status: 'aberto',
    title: row.titulo,
    description: row.descricao,
    recurrence_count: 0,
    metadata: { action_plan_id: row.id, executive_memory_id: row.executive_memory_id, gerente_responsavel: row.gerente_responsavel }
  }, { accountId }).catch(() => {});
  return clone(row);
}

export async function listActionPlans(accountId, filters = {}, options = {}) {
  assertAccountId(accountId);
  const limit = Number(options.limit ?? 100);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 100;
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('ai_director_action_plans').select('*').eq('account_id', accountId).order('criado_em', { ascending: false }).limit(safeLimit);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.gerente_responsavel) query = query.eq('gerente_responsavel', filters.gerente_responsavel);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar planos de acao', { details: error });
    return { items: data || [], total: (data || []).length };
  }
  const items = memoryStore.filter((item) => item.account_id === accountId).filter((item) => !filters.status || item.status === filters.status).filter((item) => !filters.gerente_responsavel || item.gerente_responsavel === filters.gerente_responsavel).slice(0, safeLimit).map(clone);
  return { items, total: items.length };
}

export async function updateActionPlanStatus(id, accountId, status) {
  assertAccountId(accountId);
  if (!validStatus.has(status)) throw new BadRequestError('status invalido');
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: current, error } = await supabase.from('ai_director_action_plans').select('*').eq('id', id).eq('account_id', accountId).maybeSingle();
    if (error) throw new DatabaseError('Falha ao consultar plano de acao', { details: error });
    if (!current) throw new NotFoundError('Plano de acao nao encontrado', { domain: 'ai-director-action-plans' });
    const { data: updated, error: updateError } = await supabase.from('ai_director_action_plans').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('account_id', accountId).select('*').single();
    if (updateError) throw new DatabaseError('Falha ao atualizar plano de acao', { details: updateError });
    if (status === 'concluido') {
      await createAiDirectorEvent({
        event_type: 'action_plan_completed',
        entity_type: 'plano_acao',
        entity_id: updated.id,
        status: 'resolvido',
        title: updated.titulo,
        description: updated.descricao,
        recurrence_count: 0,
        metadata: { action_plan_id: updated.id, executive_memory_id: updated.executive_memory_id }
      }, { accountId });
    }
    return updated;
  }
  const current = memoryStore.find((item) => item.id === id && item.account_id === accountId) || null;
  if (!current) throw new NotFoundError('Plano de acao nao encontrado', { domain: 'ai-director-action-plans' });
  current.status = status;
  current.updated_at = new Date().toISOString();
  if (status === 'concluido') {
    void createAiDirectorEvent({
      event_type: 'action_plan_completed',
      entity_type: 'plano_acao',
      entity_id: current.id,
      status: 'resolvido',
      title: current.titulo,
      description: current.descricao,
      recurrence_count: 0,
      metadata: { action_plan_id: current.id, executive_memory_id: current.executive_memory_id }
    }, { accountId }).catch(() => {});
  }
  return clone(current);
}

export async function listActionPlansByExecutiveMemoryId(accountId, executiveMemoryId) {
  assertAccountId(accountId);
  const normalizedExecutiveMemoryId = String(executiveMemoryId || '').trim();
  if (!normalizedExecutiveMemoryId) return { items: [], total: 0 };
  const plans = await listActionPlans(accountId, {}, { limit: 200 });
  const items = (plans.items || []).filter((item) => String(item.executive_memory_id || '').trim() === normalizedExecutiveMemoryId);
  return { items, total: items.length };
}

export function __resetMemoryAiDirectorActionPlansForTests() {
  memoryStore.length = 0;
}

export function __dumpMemoryAiDirectorActionPlansForTests() {
  return memoryStore.map(clone);
}

export function __seedMemoryAiDirectorActionPlansForTests(rows = []) {
  for (const row of rows) memoryStore.push(clone(row));
}
