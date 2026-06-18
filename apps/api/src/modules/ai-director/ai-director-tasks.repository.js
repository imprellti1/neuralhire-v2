import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { listActionPlans } from './ai-director-action-plans.repository.js';

const validStatus = new Set(['aberto', 'em_andamento', 'concluido', 'bloqueado', 'cancelado']);
const validImpactToPriority = {
  alto: 'alta',
  media: 'media',
  medio: 'media',
  baixa: 'baixa'
};

const memoryTasks = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-tasks' });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function normalizeDirectorTaskKey(value) {
  return normalizeText(value);
}

function normalizePriority(impacto, prioridadeScore = 0) {
  const mapped = validImpactToPriority[String(impacto || '').toLowerCase()];
  if (mapped) return mapped;
  const score = Number(prioridadeScore) || 0;
  if (score >= 100) return 'alta';
  if (score >= 50) return 'media';
  return 'baixa';
}

function determineGerente(actionPlan = {}) {
  const gerente = String(actionPlan.gerente_responsavel || '').trim();
  if (gerente) return gerente;
  const title = `${actionPlan.titulo || ''} ${actionPlan.descricao || ''}`.toLowerCase();
  if (title.includes('produto')) return 'gerente_produtos';
  if (title.includes('comercial') || title.includes('cliente')) return 'gerente_comercial';
  if (title.includes('auditoria') || title.includes('faturamento')) return 'gerente_auditoria';
  if (title.includes('cadastro') || title.includes('administr')) return 'gerente_administrativo';
  return 'diretor_ia';
}

function taskMetadata(actionPlan, gerente, normalizedTaskKey) {
  return {
    generated_by: 'diretor_delegacao',
    action_plan_id: actionPlan.id,
    source_action_plan_title: actionPlan.titulo || null,
    source_action_plan_score: Number(actionPlan.prioridade_score || 0),
    source_action_plan_impact: actionPlan.impacto || null,
    gerente_responsavel: gerente,
    normalized_task_key: normalizedTaskKey,
    criteria_version: 1
  };
}

function buildTask(gerente, titulo, descricao, actionPlan) {
  const normalizedTaskKey = normalizeDirectorTaskKey(titulo);
  return {
    id: randomUUID(),
    account_id: actionPlan.account_id || null,
    action_plan_id: actionPlan.id,
    gerente,
    titulo,
    descricao,
    prioridade: normalizePriority(actionPlan.impacto, actionPlan.prioridade_score),
    status: 'aberto',
    percentual_conclusao: 0,
    metadata: taskMetadata(actionPlan, gerente, normalizedTaskKey),
    criado_em: nowIso(),
    updated_at: nowIso()
  };
}

export function buildDirectorTasksForActionPlan(actionPlan = {}) {
  const gerente = determineGerente(actionPlan);
  const base = [];
  if (gerente === 'gerente_produtos') {
    base.push(
      buildTask(gerente, 'Corrigir produtos sem categoria', 'Identificar e completar categorias ausentes nos produtos priorizados pelo Diretor IA.', actionPlan),
      buildTask(gerente, 'Corrigir produtos sem imagem', 'Identificar produtos sem imagem e completar o cadastro visual.', actionPlan),
      buildTask(gerente, 'Revisar produtos sem vendas', 'Analisar produtos sem movimentação comercial e definir ajuste cadastral, exposição ou descontinuação.', actionPlan)
    );
  } else if (gerente === 'gerente_comercial') {
    base.push(
      buildTask(gerente, 'Revisar clientes sem vendedor', 'Identificar clientes sem responsável comercial e atribuir cobertura.', actionPlan),
      buildTask(gerente, 'Distribuir carteira comercial', 'Rebalancear a carteira com base em prioridade e cobertura operacional.', actionPlan),
      buildTask(gerente, 'Priorizar clientes críticos', 'Separar e tratar os clientes com maior risco ou potencial imediato.', actionPlan)
    );
  } else if (gerente === 'gerente_auditoria') {
    base.push(
      buildTask(gerente, 'Revisar pedidos sem comissão', 'Localizar pedidos sem comissão calculada e corrigir a base operacional.', actionPlan),
      buildTask(gerente, 'Revisar pedidos sem itens', 'Auditar pedidos inconsistentes sem itens associados.', actionPlan),
      buildTask(gerente, 'Corrigir inconsistências de faturamento', 'Validar divergências financeiras e ajustar os registros necessários.', actionPlan)
    );
  } else if (gerente === 'gerente_administrativo') {
    base.push(
      buildTask(gerente, 'Revisar cadastros incompletos', 'Auditar registros com dados cadastrais pendentes e completar o que faltar.', actionPlan),
      buildTask(gerente, 'Corrigir dados administrativos pendentes', 'Resolver pendências administrativas apontadas pelo Diretor IA.', actionPlan),
      buildTask(gerente, 'Validar pendências operacionais', 'Checar pendências operacionais e confirmar o encerramento correto.', actionPlan)
    );
  } else {
    base.push(
      buildTask('diretor_ia', 'Analisar plano de ação executivo', 'Revisar o plano executivo e preparar a delegação operacional.', actionPlan),
      buildTask('diretor_ia', 'Definir responsável operacional', 'Atribuir o gerente responsável por cada frente do plano.', actionPlan),
      buildTask('diretor_ia', 'Registrar próximos passos', 'Documentar as etapas seguintes para acompanhamento futuro.', actionPlan)
    );
  }
  return base.map((task) => ({
    ...task,
    metadata: {
      ...task.metadata,
      normalized_task_key: normalizeDirectorTaskKey(task.titulo)
    }
  }));
}

function resolveSupabaseConfigured() {
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return getSupabaseClient();
}

async function listTasksSupabase(accountId, filters = {}) {
  const supabase = resolveSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  let query = supabase.from('ai_director_tasks').select('*').eq('account_id', accountId).order('updated_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.gerente) query = query.eq('gerente', filters.gerente);
  if (filters.action_plan_id) query = query.eq('action_plan_id', filters.action_plan_id);
  const { data, error } = await query;
  if (error) throw new DatabaseError('Falha ao listar tarefas', { details: error });
  return data || [];
}

export async function listOpenActionPlansWithoutTasks(accountId) {
  assertAccountId(accountId);
  const plansResult = await listActionPlans(accountId, { status: 'aberto' }, { limit: 200 });
  const plans = plansResult.items || [];
  const activeTasks = await listDirectorTasks(accountId, {});
  const taskPlanIds = new Set(activeTasks.filter((task) => String(task.status || '') !== 'cancelado').map((task) => String(task.action_plan_id || '').trim()).filter(Boolean));
  return plans.filter((plan) => !taskPlanIds.has(String(plan.id || '').trim()));
}

export async function upsertDirectorTask(payload = {}) {
  const accountId = payload.account_id || null;
  assertAccountId(accountId);
  const normalizedTaskKey = normalizeDirectorTaskKey(payload?.metadata?.normalized_task_key || payload.titulo);
  const row = {
    id: payload.id || randomUUID(),
    account_id: accountId,
    action_plan_id: payload.action_plan_id,
    gerente: payload.gerente,
    titulo: payload.titulo,
    descricao: payload.descricao || null,
    prioridade: payload.prioridade,
    status: validStatus.has(String(payload.status || '').toLowerCase()) ? String(payload.status).toLowerCase() : 'aberto',
    percentual_conclusao: Math.max(0, Math.min(100, Number(payload.percentual_conclusao ?? 0) || 0)),
    metadata: { ...(payload.metadata || {}), normalized_task_key: normalizedTaskKey },
    criado_em: payload.criado_em || nowIso(),
    updated_at: nowIso()
  };

  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: current, error: currentError } = await supabase
      .from('ai_director_tasks')
      .select('*')
      .eq('account_id', accountId)
      .eq('action_plan_id', row.action_plan_id)
      .eq('metadata->>normalized_task_key', normalizedTaskKey)
      .maybeSingle();
    if (currentError) throw new DatabaseError('Falha ao consultar tarefa', { details: currentError });
    if (current) {
      const { data, error } = await supabase.from('ai_director_tasks').update({ ...row, id: current.id, criado_em: current.criado_em }).eq('id', current.id).select('*').single();
      if (error) throw new DatabaseError('Falha ao atualizar tarefa', { details: error });
      return data;
    }
    const { data, error } = await supabase.from('ai_director_tasks').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar tarefa', { details: error });
    return data;
  }

  const current = memoryTasks.find((task) =>
    task.account_id === accountId &&
    task.action_plan_id === row.action_plan_id &&
    task.status !== 'cancelado' &&
    String(task.metadata?.normalized_task_key || '') === normalizedTaskKey
  ) || null;
  if (current) {
    Object.assign(current, row, { id: current.id, criado_em: current.criado_em });
    return clone(current);
  }
  memoryTasks.push(row);
  return clone(row);
}

export async function listDirectorTasks(accountId, filters = {}) {
  assertAccountId(accountId);
  if (resolveSupabaseConfigured()) return listTasksSupabase(accountId, filters);
  return memoryTasks
    .filter((task) => task.account_id === accountId)
    .filter((task) => !filters.status || task.status === filters.status)
    .filter((task) => !filters.gerente || task.gerente === filters.gerente)
    .filter((task) => !filters.action_plan_id || task.action_plan_id === filters.action_plan_id)
    .map(clone)
    .sort((a, b) => new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime());
}

export async function updateDirectorTaskStatus(id, accountId, status) {
  assertAccountId(accountId);
  if (!validStatus.has(String(status || '').toLowerCase())) throw new BadRequestError('status invalido');
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: current, error } = await supabase.from('ai_director_tasks').select('*').eq('id', id).eq('account_id', accountId).maybeSingle();
    if (error) throw new DatabaseError('Falha ao consultar tarefa', { details: error });
    if (!current) throw new NotFoundError('Tarefa nao encontrada', { domain: 'ai-director-tasks' });
    const percentual = status === 'concluido' ? 100 : current.percentual_conclusao;
    const { data, error: updateError } = await supabase.from('ai_director_tasks').update({ status, percentual_conclusao: percentual, updated_at: nowIso() }).eq('id', id).eq('account_id', accountId).select('*').single();
    if (updateError) throw new DatabaseError('Falha ao atualizar tarefa', { details: updateError });
    return data;
  }
  const current = memoryTasks.find((task) => String(task.id) === String(id) && task.account_id === accountId) || null;
  if (!current) throw new NotFoundError('Tarefa nao encontrada', { domain: 'ai-director-tasks' });
  current.status = String(status).toLowerCase();
  current.percentual_conclusao = current.status === 'concluido' ? 100 : current.percentual_conclusao;
  current.updated_at = nowIso();
  return clone(current);
}

export function __resetMemoryAiDirectorTasksForTests() {
  memoryTasks.length = 0;
}
