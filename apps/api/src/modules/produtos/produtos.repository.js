import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryProdutos = [];

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', {
      code: 'TENANT_REQUIRED',
      domain: 'produtos-catalogo',
      details: { reason: 'account_id_missing' }
    });
  }
}

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20;
  const limit = Math.min(rawLimit, 100);
  return { page, limit };
}

function debugRepository(action, payload) {
  if (env.NODE_ENV === 'production') return;
  console.debug(`[produtos.repository] ${action}`, payload);
}

function applyMemoryFilters(items, filters = {}, accountId) {
  let result = items.filter((item) => item.account_id === accountId);
  if (typeof filters.ativo === 'boolean') result = result.filter((item) => item.ativo === filters.ativo);
  if (filters.categoria) result = result.filter((item) => String(item.categoria || '').toLowerCase() === String(filters.categoria).toLowerCase());
  if (filters.marca) result = result.filter((item) => String(item.marca || '').toLowerCase() === String(filters.marca).toLowerCase());
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    result = result.filter((item) => [item.nome, item.sku, item.codigo, item.descricao, item.categoria, item.marca].some((v) => String(v || '').toLowerCase().includes(q)));
  }
  return result;
}

function scoreItem(item, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 0;
  let score = 0;
  const fields = [
    ['nome', 6],
    ['sku', 5],
    ['codigo', 4],
    ['marca', 3],
    ['categoria', 2],
    ['descricao', 1]
  ];
  for (const [field, weight] of fields) {
    const value = String(item[field] || '').toLowerCase();
    if (!value) continue;
    if (value === q) score += weight + 3;
    else if (value.startsWith(q)) score += weight + 1;
    else if (value.includes(q)) score += weight;
  }
  return score;
}

export function getProdutosRepositoryMode() {
  return {
    mode: isSupabaseConfigured() ? 'supabase' : 'memory',
    supabaseConfigured: isSupabaseConfigured()
  };
}

export async function listProdutos(filters = {}, options = {}) {
  const { page, limit } = normalizePagination(filters);
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const repositoryMode = getProdutosRepositoryMode();
  debugRepository('listProdutos', { repositoryMode, accountId, filters });

  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');

    let query = supabase.from('produtos').select('*', { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false });
    if (typeof filters.ativo === 'boolean') query = query.eq('ativo', filters.ativo);
    if (filters.categoria) query = query.eq('categoria', filters.categoria);
    if (filters.marca) query = query.eq('marca', filters.marca);
    if (filters.search) {
      const search = String(filters.search).trim();
      if (search) query = query.or(`nome.ilike.%${search}%,sku.ilike.%${search}%,codigo.ilike.%${search}%,descricao.ilike.%${search}%,categoria.ilike.%${search}%,marca.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw new DatabaseError('Falha ao listar produtos', { details: error });

    const total = count || 0;
    return { items: data || [], total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  const filtered = applyMemoryFilters(memoryProdutos, filters, accountId);
  const total = filtered.length;
  const from = (page - 1) * limit;
  return { items: filtered.slice(from, from + limit), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getProdutoById(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const repositoryMode = getProdutosRepositoryMode();

  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('produtos').select('*').eq('account_id', accountId).eq('id', id).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar produto', { details: error });
    if (!data) throw new NotFoundError('Produto nao encontrado', { domain: 'produtos-catalogo', code: 'PRODUTO_NOT_FOUND' });
    return data;
  }

  const item = memoryProdutos.find((produto) => produto.id === id && produto.account_id === accountId);
  if (!item) throw new NotFoundError('Produto nao encontrado', { domain: 'produtos-catalogo', code: 'PRODUTO_NOT_FOUND' });
  return item;
}

export async function searchProdutos(query, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const searchQuery = String(query || '').trim();

  if (!searchQuery) return { items: [], total: 0, query: searchQuery };

  const repositoryMode = getProdutosRepositoryMode();
  debugRepository('searchProdutos', { repositoryMode, accountId, query: searchQuery });

  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('produtos')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .or(`nome.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,codigo.ilike.%${searchQuery}%,descricao.ilike.%${searchQuery}%,categoria.ilike.%${searchQuery}%,marca.ilike.%${searchQuery}%`)
      .limit(100);
    if (error) throw new DatabaseError('Falha na busca de produtos', { details: error });
    return { items: data || [], total: (data || []).length, query: searchQuery };
  }

  const items = memoryProdutos
    .filter((item) => item.account_id === accountId)
    .map((item) => ({ item, score: scoreItem(item, searchQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  return { items, total: items.length, query: searchQuery };
}

export async function createProduto(data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const repositoryMode = getProdutosRepositoryMode();
  debugRepository('createProduto', { repositoryMode, accountId, filters: null });

  const payload = {
    account_id: accountId,
    codigo: data.codigo || null,
    sku: data.sku || null,
    nome: data.nome,
    descricao: data.descricao || null,
    categoria: data.categoria || null,
    marca: data.marca || null,
    ean: data.ean || null,
    ncm: data.ncm || null,
    preco: Number.isFinite(data.preco) ? data.preco : 0,
    custo: Number.isFinite(data.custo) ? data.custo : null,
    estoque: Number.isFinite(data.estoque) ? data.estoque : 0,
    unidade: data.unidade || 'UN',
    ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
    tags: Array.isArray(data.tags) ? data.tags : [],
    metadata: data.metadata || {}
  };

  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: inserted, error } = await supabase.from('produtos').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar produto', { details: error });
    return inserted;
  }

  const item = { id: randomUUID(), ...payload, createdAt: new Date().toISOString() };
  memoryProdutos.push(item);
  return item;
}

export async function updateProduto(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getProdutoById(id, { accountId });

  const statusRaw = data.status !== undefined ? String(data.status || '').trim().toLowerCase() : null;
  if (statusRaw !== null && statusRaw !== 'ativo' && statusRaw !== 'inativo') {
    throw new BadRequestError('Status invalido', { code: 'VALIDATION_ERROR', domain: 'produtos-catalogo' });
  }

  const precoRaw = data.preco !== undefined ? data.preco : data.preco_unitario;
  if (precoRaw !== undefined && (!Number.isFinite(Number(precoRaw)) || Number(precoRaw) <= 0)) {
    throw new BadRequestError('Preco invalido', { code: 'VALIDATION_ERROR', domain: 'produtos-catalogo' });
  }

  const nome = data.nome !== undefined ? String(data.nome || '').trim() : undefined;
  if (nome !== undefined && nome.length < 2) {
    throw new BadRequestError('Nome invalido', { code: 'VALIDATION_ERROR', domain: 'produtos-catalogo' });
  }

  const nextAtivo = statusRaw ? statusRaw === 'ativo' : (typeof data.ativo === 'boolean' ? data.ativo : undefined);
  const payload = {
    ...(nome !== undefined ? { nome } : {}),
    ...(data.descricao !== undefined ? { descricao: data.descricao || null } : {}),
    ...(data.sku !== undefined ? { sku: data.sku || null } : {}),
    ...(data.categoria !== undefined ? { categoria: data.categoria || null } : {}),
    ...(precoRaw !== undefined ? { preco: Number(precoRaw) } : {}),
    ...(statusRaw ? { status: statusRaw } : {}),
    ...(nextAtivo !== undefined ? { ativo: nextAtivo } : {})
  };

  if (getProdutosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('produtos').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar produto', { details: error });
    return updated;
  }

  const idx = memoryProdutos.findIndex((produto) => produto.id === id && produto.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Produto nao encontrado', { domain: 'produtos-catalogo', code: 'PRODUTO_NOT_FOUND' });
  memoryProdutos[idx] = { ...memoryProdutos[idx], ...payload, updatedAt: new Date().toISOString() };
  return memoryProdutos[idx];
}

export function __resetMemoryProdutosForTests() {
  memoryProdutos.length = 0;
}

export function __dumpMemoryProdutos() {
  return memoryProdutos.map((item) => ({ ...item }));
}

export function __loadMemoryProdutos(items = []) {
  memoryProdutos.length = 0;
  for (const item of items) {
    memoryProdutos.push({ ...item });
  }
}
