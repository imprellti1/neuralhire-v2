import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryCategorias = [];

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produto-categorias' }); }
function slugify(value) { return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function cleanText(value) { return String(value || '').trim(); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function mode() { return { mode: isSupabaseConfigured() ? 'supabase' : 'memory' }; }

export async function listProdutoCategorias(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (mode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let q = supabase.from('produto_categorias').select('*').eq('account_id', accountId).order('parent_id', { ascending: true }).order('nome', { ascending: true });
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error } = await q; if (error) throw new DatabaseError('Falha ao listar categorias', { details: error });
    return { items: data || [], total: (data || []).length };
  }
  return { items: memoryCategorias.filter((i) => i.account_id === accountId).map(clone), total: memoryCategorias.length };
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
  const payload = { id: randomUUID(), account_id: accountId, parent_id: parentId, nome, slug: cleanText(data.slug) || slugify(nome), descricao: cleanText(data.descricao) || null, status: String(data.status || 'ativo') === 'inativo' ? 'inativo' : 'ativo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (mode().mode === 'supabase') { const supabase = getSupabaseClient(); const { data: inserted, error } = await supabase.from('produto_categorias').insert(payload).select('*').single(); if (error) throw new DatabaseError('Falha ao criar categoria', { details: error }); return inserted; }
  memoryCategorias.push(payload); return clone(payload);
}

export async function updateProdutoCategoria(id, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await getProdutoCategoriaById(id, { accountId });
  if (data.parent_id === id) throw new BadRequestError('Categoria nao pode apontar para si mesma');
  if (data.parent_id) await ensureParentBelongsToAccount(data.parent_id, accountId);
  const patch = { ...(data.nome !== undefined ? { nome: cleanText(data.nome) } : {}), ...(data.slug !== undefined ? { slug: cleanText(data.slug) || undefined } : {}), ...(data.descricao !== undefined ? { descricao: cleanText(data.descricao) || null } : {}), ...(data.status !== undefined ? { status: String(data.status) === 'inativo' ? 'inativo' : 'ativo' } : {}), ...(data.parent_id !== undefined ? { parent_id: data.parent_id || null } : {}) };
  if (patch.nome !== undefined && !patch.nome) throw new BadRequestError('Nome obrigatorio');
  if (!patch.slug && patch.nome) patch.slug = slugify(patch.nome);
  if (mode().mode === 'supabase') { const supabase = getSupabaseClient(); const { data: updated, error } = await supabase.from('produto_categorias').update(patch).eq('account_id', accountId).eq('id', id).select('*').single(); if (error) throw new DatabaseError('Falha ao atualizar categoria', { details: error }); return updated; }
  const idx = memoryCategorias.findIndex((i) => i.id === id && i.account_id === accountId); memoryCategorias[idx] = { ...memoryCategorias[idx], ...patch, updated_at: new Date().toISOString() }; return clone(memoryCategorias[idx]);
}

export function __resetMemoryProdutoCategorias() { memoryCategorias.length = 0; }
