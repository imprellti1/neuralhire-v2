import { randomUUID } from 'node:crypto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { AiDirectorActionPlansQueries } from '../../database/queries/ai-director-action-plans.queries.js';
import { createAiDirectorEvent } from './ai-director-events.repository.js';
import { listExecutiveMemories } from './ai-director.repository.js';

const validStatus = new Set(['aberto', 'em_andamento', 'concluido', 'cancelado']);
const memoryStore = [];
let repositoryOverride = null;

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director-action-plans' });
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }

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

function normalizeActionPlan(row = {}) {
  return {
    ...row,
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}
  };
}

function isOpenPlan(plan = {}) {
  return String(plan.status || '').trim() === 'aberto';
}

function actionPlanDedupeMatch(row, normalizedExecutiveMemoryId, normalizedTitleKey) {
  return String(row.executive_memory_id || '').trim() === normalizedExecutiveMemoryId ||
    String(row.metadata?.normalized_title_key || '').trim() === normalizedTitleKey;
}

class AiDirectorActionPlansRepository extends BaseRepository {
  constructor(adapter = database, options = {}) {
    super(adapter, { logContext: 'ai-director-action-plans' });
    this.useDatabase = Boolean(options.useDatabase);
  }

  async listOpenExecutiveMemories(accountId, options = {}) {
    const limit = Number(options.limit ?? 50);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
    const memories = await listExecutiveMemories({ limit: safeLimit }, { accountId });
    const plans = await this.listActionPlans(accountId, { status: 'aberto' }, { limit: 200 });
    const blocked = new Set((plans.items || []).map((item) => String(item.executive_memory_id || '').trim()).filter(Boolean));
    const items = (memories.items || []).filter((item) => !blocked.has(String(item.id || '').trim()));
    return { items, total: items.length };
  }

  async upsertActionPlan(payload = {}, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    const normalized = normalizePayload(payload);
    const normalizedTitleKey = String(normalized.metadata?.normalized_title_key || '').trim() || normalizeActionPlanTitleKey(normalized.titulo);
    const normalizedExecutiveMemoryId = String(normalized.executive_memory_id || '').trim();
    const row = normalizeActionPlan({ id: randomUUID(), account_id: accountId, ...normalized, updated_at: nowIso(), criado_em: nowIso() });
    row.metadata = { ...row.metadata, normalized_title_key: normalizedTitleKey };

    if (this.useDatabase && this.database?.query) {
      const current = await this.many(AiDirectorActionPlansQueries.listOpenActionPlansByAccount(), [accountId, 200]);
      const match = (current || []).find((item) => actionPlanDedupeMatch(item, normalizedExecutiveMemoryId, normalizedTitleKey)) || null;
      if (match) {
        const updated = await this.one(AiDirectorActionPlansQueries.updateActionPlanById(), [
          accountId,
          match.id,
          normalized.executive_memory_id,
          normalized.titulo,
          normalized.descricao,
          normalized.gerente_responsavel,
          normalized.impacto,
          normalized.esforco,
          normalized.prioridade_score,
          normalized.prazo_dias,
          normalized.status,
          row.metadata,
          nowIso()
        ]);
        await createAiDirectorEvent({
          event_type: 'action_plan_created',
          entity_type: 'plano_acao',
          entity_id: updated.id,
          status: 'aberto',
          title: updated.titulo,
          description: updated.descricao,
          recurrence_count: 0,
          metadata: { action_plan_id: updated.id, executive_memory_id: updated.executive_memory_id, gerente_responsavel: updated.gerente_responsavel }
        }, { accountId });
        return updated;
      }
      const created = await this.one(AiDirectorActionPlansQueries.insertActionPlan(), [
        row.id, row.account_id, row.executive_memory_id, row.titulo, row.descricao, row.gerente_responsavel, row.impacto, row.esforco, row.prioridade_score, row.prazo_dias, row.status, row.metadata, row.criado_em, row.updated_at
      ]);
      await createAiDirectorEvent({
        event_type: 'action_plan_created',
        entity_type: 'plano_acao',
        entity_id: created.id,
        status: 'aberto',
        title: created.titulo,
        description: created.descricao,
        recurrence_count: 0,
        metadata: { action_plan_id: created.id, executive_memory_id: created.executive_memory_id, gerente_responsavel: created.gerente_responsavel }
      }, { accountId });
      return created;
    }

    const current = memoryStore.find((item) => item.account_id === accountId && item.status === 'aberto' && actionPlanDedupeMatch(item, normalizedExecutiveMemoryId, normalizedTitleKey)) || null;
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

  async listActionPlans(accountId, filters = {}, options = {}) {
    assertAccountId(accountId);
    const limit = Number(options.limit ?? 100);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 100;
    if (this.useDatabase && this.database?.query) {
      const params = [accountId];
      const where = [];
      if (filters.status) { params.push(filters.status); where.push(`status = $${params.length}`); }
      if (filters.gerente_responsavel) { params.push(filters.gerente_responsavel); where.push(`gerente_responsavel = $${params.length}`); }
      const rows = await this.many(AiDirectorActionPlansQueries.listActionPlans(where.join(' AND ')), [accountId, safeLimit]);
      return { items: rows || [], total: (rows || []).length };
    }
    const items = memoryStore
      .filter((item) => item.account_id === accountId)
      .filter((item) => !filters.status || item.status === filters.status)
      .filter((item) => !filters.gerente_responsavel || item.gerente_responsavel === filters.gerente_responsavel)
      .slice(0, safeLimit)
      .map(clone);
    return { items, total: items.length };
  }

  async updateActionPlanStatus(id, accountId, status) {
    assertAccountId(accountId);
    if (!validStatus.has(status)) throw new BadRequestError('status invalido');
    if (this.useDatabase && this.database?.query) {
      const current = await this.one(AiDirectorActionPlansQueries.getActionPlanById(), [accountId, id]).catch((error) => {
        if (error?.code === 'DATABASE_NOT_ONE') throw new NotFoundError('Plano de acao nao encontrado', { domain: 'ai-director-action-plans' });
        throw error;
      });
      const updated = await this.one(AiDirectorActionPlansQueries.updateActionPlanStatus(), [accountId, id, status, nowIso()]);
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
      void current;
      return updated;
    }
    const current = memoryStore.find((item) => item.id === id && item.account_id === accountId) || null;
    if (!current) throw new NotFoundError('Plano de acao nao encontrado', { domain: 'ai-director-action-plans' });
    current.status = status;
    current.updated_at = nowIso();
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

  async listActionPlansByExecutiveMemoryId(accountId, executiveMemoryId) {
    assertAccountId(accountId);
    const normalizedExecutiveMemoryId = String(executiveMemoryId || '').trim();
    if (!normalizedExecutiveMemoryId) return { items: [], total: 0 };
    const plans = await this.listActionPlans(accountId, {}, { limit: 200 });
    const items = (plans.items || []).filter((item) => String(item.executive_memory_id || '').trim() === normalizedExecutiveMemoryId);
    return { items, total: items.length };
  }
}

const repository = new AiDirectorActionPlansRepository();

export async function listOpenExecutiveMemories(accountId, options = {}) {
  return resolveRepository().listOpenExecutiveMemories(accountId, options);
}

export async function upsertActionPlan(payload = {}, options = {}) {
  return resolveRepository().upsertActionPlan(payload, options);
}

export async function listActionPlans(accountId, filters = {}, options = {}) {
  return resolveRepository().listActionPlans(accountId, filters, options);
}

export async function updateActionPlanStatus(id, accountId, status) {
  return resolveRepository().updateActionPlanStatus(id, accountId, status);
}

export async function listActionPlansByExecutiveMemoryId(accountId, executiveMemoryId) {
  return resolveRepository().listActionPlansByExecutiveMemoryId(accountId, executiveMemoryId);
}

function resolveRepository() {
  return repositoryOverride || repository;
}

export function __resetMemoryAiDirectorActionPlansForTests() {
  memoryStore.length = 0;
  repositoryOverride = null;
}

export function __dumpMemoryAiDirectorActionPlansForTests() {
  return memoryStore.map(clone);
}

export function __seedMemoryAiDirectorActionPlansForTests(rows = []) {
  for (const row of rows) memoryStore.push(clone(row));
}

export function __setAiDirectorActionPlansDatabaseForTests(adapter) {
  repositoryOverride = adapter instanceof AiDirectorActionPlansRepository ? adapter : new AiDirectorActionPlansRepository(adapter, { useDatabase: true });
}
