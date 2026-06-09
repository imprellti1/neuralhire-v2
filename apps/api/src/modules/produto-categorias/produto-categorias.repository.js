import { randomUUID } from 'node:crypto';
import { BadRequestError, ConflictError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryCategorias = [];

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produto-categorias' }); }
function slugify(value) { return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function cleanText(value) { return String(value || '').trim(); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function mode() { return { mode: isSupabaseConfigured() ? 'supabase' : 'memory' }; }
function normalizeStatus(value) {
  return String(value || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
}
function isDuplicateError(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('duplicate') || text.includes('unique') || text.includes('already exists') || text.includes('produto_categorias_account_id_slug_key');
}
async function ensureUniqueSlug(accountId, slug, ignoreId = null) {
  if (!slug) throw new BadRequestError('Slug obrigatorio');
  if (mode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    const query = supabase.from('produto_categorias').select('id').eq('account_id', accountId).eq('slug', slug);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao validar slug', { details: error });
    const match = (data || []).find((item) => String(item.id) !== String(ignoreId || ''));
    if (match) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' });
    return;
  }
  const match = memoryCategorias.find((item) => item.account_id === accountId && item.slug === slug && String(item.id) !== String(ignoreId || ''));
  if (match) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' });
}

export async function listProdutoCategorias(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (mode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let q = supabase.from('produto_categorias').select('*').eq('account_id', accountId).order('parent_id', { ascending: true }).order('nome', { ascending: true });
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error } = await q; if (error) throw new DatabaseError('Falha ao listar categorias', { details: error });
    return { items: data || [], total: (data || []).length };
  }
  const items = memoryCategorias.filter((i) => i.account_id === accountId && (!filters.status || i.status === filters.status)).map(clone);
  return { items, total: items.length };
}

async function ensureParentBelongsToAccount(parentId, accountId) {
  if (!parentId) return null;
  const parent = await getProdutoCategoriaById(parentId, { accountId });
  if (String(parent.account_id) !== String(accountId)) throw new BadRequestError('Categoria pai de outra conta nao permitida');
  return parent;
}

export async function getProdutoCategoriaById(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (mode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('produto_categorias').select('*').eq('account_id', accountId).eq('id', id).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar categoria', { details: error });
    if (!data) throw new NotFoundError('Categoria nao encontrada');
    return data;
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
  if (mode().mode === 'supabase') { const supabase = getSupabaseClient(); const { data: inserted, error } = await supabase.from('produto_categorias').insert(payload).select('*').single(); if (error) { if (isDuplicateError(error)) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' }); throw new DatabaseError('Falha ao criar categoria', { details: error }); } return inserted; }
  memoryCategorias.push(payload); return clone(payload);
}

export async function updateProdutoCategoria(id, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await getProdutoCategoriaById(id, { accountId });
  if (data.parent_id === id) throw new BadRequestError('Categoria nao pode apontar para si mesma');
  if (data.parent_id) await ensureParentBelongsToAccount(data.parent_id, accountId);
  const current = await getProdutoCategoriaById(id, { accountId });
  const nextNome = data.nome !== undefined ? cleanText(data.nome) : undefined;
  if (nextNome !== undefined && !nextNome) throw new BadRequestError('Nome obrigatorio');
  const nextSlug = nextNome ? slugify(nextNome) : current.slug;
  await ensureUniqueSlug(accountId, nextSlug, id);
  const patch = { ...(nextNome !== undefined ? { nome: nextNome } : {}), slug: nextSlug, ...(data.descricao !== undefined ? { descricao: cleanText(data.descricao) || null } : {}), ...(data.status !== undefined ? { status: normalizeStatus(data.status) } : {}), ...(data.parent_id !== undefined ? { parent_id: data.parent_id || null } : {}), updated_at: new Date().toISOString() };
  if (mode().mode === 'supabase') { const supabase = getSupabaseClient(); const { data: updated, error } = await supabase.from('produto_categorias').update(patch).eq('account_id', accountId).eq('id', id).select('*').single(); if (error) { if (isDuplicateError(error)) throw new ConflictError('Categoria duplicada', { code: 'PRODUTO_CATEGORIA_DUPLICADA', domain: 'produto-categorias' }); throw new DatabaseError('Falha ao atualizar categoria', { details: error }); } return updated; }
  const idx = memoryCategorias.findIndex((i) => i.id === id && i.account_id === accountId); memoryCategorias[idx] = { ...memoryCategorias[idx], ...patch }; return clone(memoryCategorias[idx]);
}

export async function deleteProdutoCategoria(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const item = await getProdutoCategoriaById(id, { accountId });
  const patch = { status: 'inativo', updated_at: new Date().toISOString() };
  if (mode().mode === 'supabase') { const supabase = getSupabaseClient(); const { data, error } = await supabase.from('produto_categorias').update(patch).eq('account_id', accountId).eq('id', id).select('*').single(); if (error) throw new DatabaseError('Falha ao inativar categoria', { details: error }); return data; }
  const idx = memoryCategorias.findIndex((i) => i.id === item.id && i.account_id === accountId); memoryCategorias[idx] = { ...memoryCategorias[idx], ...patch }; return clone(memoryCategorias[idx]);
}

export function __resetMemoryProdutoCategorias() { memoryCategorias.length = 0; }
