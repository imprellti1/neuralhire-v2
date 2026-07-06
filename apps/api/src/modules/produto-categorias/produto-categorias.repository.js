import { randomUUID } from 'node:crypto';
import { BadRequestError, ConflictError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { ProdutoCategoriasQueries } from '../../database/queries/produto-categorias.queries.js';

const memoryCategorias = [];
let databaseModeCache = null;

class ProdutoCategoriasRepository extends BaseRepository {
  constructor(adapter = database) {
    super(adapter, { logContext: 'produto-categorias' });
  }
}

const repository = new ProdutoCategoriasRepository();

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produto-categorias' }); }
function slugify(value) { return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function cleanText(value) { return String(value || '').trim(); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function normalizeStatus(value) { return String(value || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo'; }

function isDuplicateError(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('duplicate') || text.includes('unique') || text.includes('already exists') || text.includes('produto_categorias_account_id_slug_key');
}

export function getProdutoCategoriasRepositoryMode() {
  return { mode: databaseModeCache === false ? 'memory' : 'database', databaseModeCache };
}

async function isDatabaseMode() {
  if (databaseModeCache !== null) return databaseModeCache;
  try {
    await repository.one(ProdutoCategoriasQueries.ping(), []);
    databaseModeCache = true;
  } catch (error) {
    databaseModeCache = false;
    if (error?.code !== 'ECONNREFUSED' && error?.cause?.code !== 'ECONNREFUSED') {
      // Keep the fallback silent unless it is a real connectivity surprise.
    }
  }
  return databaseModeCache;
}

async function ensureUniqueSlug(accountId, slug, ignoreId = null) {
  if (!slug) throw new BadRequestError('Slug obrigatorio');
  if (await isDatabaseMode()) {
    const row = await repository.one(ProdutoCategoriasQueries.getBySlug(), [accountId, slug]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      throw new DatabaseError('Falha ao validar slug', { details: error });
    });
    if (row && String(row.id) !== String(ignoreId || '')) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' });
    return;
  }
  const match = memoryCategorias.find((item) => item.account_id === accountId && item.slug === slug && String(item.id) !== String(ignoreId || ''));
  if (match) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' });
}

async function ensureParentBelongsToAccount(parentId, accountId) {
  if (!parentId) return null;
  const parent = await getProdutoCategoriaById(parentId, { accountId });
  if (String(parent.account_id) !== String(accountId)) throw new BadRequestError('Categoria pai de outra conta nao permitida');
  return parent;
}

export async function listProdutoCategorias(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (await isDatabaseMode()) {
    const rows = await repository.many(ProdutoCategoriasQueries.list(), [accountId]);
    const items = (rows || []).filter((item) => !filters.status || item.status === filters.status);
    return { items, total: items.length };
  }
  const items = memoryCategorias.filter((i) => i.account_id === accountId && (!filters.status || i.status === filters.status)).map(clone);
  return { items, total: items.length };
}

export async function getProdutoCategoriaById(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (await isDatabaseMode()) {
    const item = await repository.one(ProdutoCategoriasQueries.getById(), [accountId, id]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      throw new DatabaseError('Falha ao buscar categoria', { details: error });
    });
    if (!item) throw new NotFoundError('Categoria nao encontrada');
    return item;
  }
  const item = memoryCategorias.find((i) => i.id === id && i.account_id === accountId);
  if (!item) throw new NotFoundError('Categoria nao encontrada');
  return clone(item);
}

export async function createProdutoCategoria(data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const nome = cleanText(data.nome); if (!nome) throw new BadRequestError('Nome obrigatorio');
  const parentId = data.parent_id || null; if (parentId) await ensureParentBelongsToAccount(parentId, accountId);
  const slug = slugify(nome);
  await ensureUniqueSlug(accountId, slug);
  const payload = { id: randomUUID(), account_id: accountId, parent_id: parentId, nome, slug, descricao: cleanText(data.descricao) || null, status: normalizeStatus(data.status), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (await isDatabaseMode()) {
    try {
      const inserted = await repository.one(ProdutoCategoriasQueries.insert(), [payload.id, payload.account_id, payload.parent_id, payload.nome, payload.slug, payload.descricao, payload.status, payload.created_at, payload.updated_at]);
      return inserted;
    } catch (error) {
      if (isDuplicateError(error)) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' });
      throw new DatabaseError('Falha ao criar categoria', { details: error });
    }
  }
  memoryCategorias.push(payload); return clone(payload);
}

export async function updateProdutoCategoria(id, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const current = await getProdutoCategoriaById(id, { accountId });
  if (data.parent_id === id) throw new BadRequestError('Categoria nao pode apontar para si mesma');
  if (data.parent_id) await ensureParentBelongsToAccount(data.parent_id, accountId);
  const nextNome = data.nome !== undefined ? cleanText(data.nome) : undefined;
  if (nextNome !== undefined && !nextNome) throw new BadRequestError('Nome obrigatorio');
  const nextSlug = nextNome ? slugify(nextNome) : current.slug;
  await ensureUniqueSlug(accountId, nextSlug, id);
  const patch = { ...(nextNome !== undefined ? { nome: nextNome } : {}), slug: nextSlug, ...(data.descricao !== undefined ? { descricao: cleanText(data.descricao) || null } : {}), ...(data.status !== undefined ? { status: normalizeStatus(data.status) } : {}), ...(data.parent_id !== undefined ? { parent_id: data.parent_id || null } : {}), updated_at: new Date().toISOString() };
  if (await isDatabaseMode()) {
    try {
      return await repository.one(ProdutoCategoriasQueries.update(), [accountId, id, patch.parent_id ?? current.parent_id ?? null, patch.nome ?? current.nome, patch.slug ?? current.slug, patch.descricao ?? current.descricao ?? null, patch.status ?? current.status, patch.updated_at]);
    } catch (error) {
      if (isDuplicateError(error)) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' });
      throw new DatabaseError('Falha ao atualizar categoria', { details: error });
    }
  }
  const idx = memoryCategorias.findIndex((i) => i.id === id && i.account_id === accountId); memoryCategorias[idx] = { ...memoryCategorias[idx], ...patch }; return clone(memoryCategorias[idx]);
}

export async function deleteProdutoCategoria(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const item = await getProdutoCategoriaById(id, { accountId });
  const patch = { status: 'inativo', updated_at: new Date().toISOString() };
  if (await isDatabaseMode()) {
    try {
      return await repository.one(ProdutoCategoriasQueries.update(), [accountId, id, item.parent_id || null, item.nome, item.slug, item.descricao || null, patch.status, patch.updated_at]);
    } catch (error) {
      throw new DatabaseError('Falha ao inativar categoria', { details: error });
    }
  }
  const idx = memoryCategorias.findIndex((i) => i.id === item.id && i.account_id === accountId); memoryCategorias[idx] = { ...memoryCategorias[idx], ...patch }; return clone(memoryCategorias[idx]);
}

export function __resetMemoryProdutoCategorias() { memoryCategorias.length = 0; databaseModeCache = null; }
