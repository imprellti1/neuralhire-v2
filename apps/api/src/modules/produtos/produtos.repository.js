import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';
import { getProdutoCategoriaById } from '../produto-categorias/produto-categorias.repository.js';

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
  if (filters.categoria_id) result = result.filter((item) => String(item.categoria_id || '') === String(filters.categoria_id || ''));
  if (filters.marca) result = result.filter((item) => String(item.marca || '').toLowerCase() === String(filters.marca).toLowerCase());
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    result = result.filter((item) => [item.nome, item.sku, item.codigo, item.descricao, item.marca].some((v) => String(v || '').toLowerCase().includes(q)));
  }
  return result;
}

function normalizeNullableUuid(value) {
  const raw = String(value || '').trim();
  return raw || null;
}

async function resolveFabricanteForProduto(accountId, fabricanteId) {
  const normalized = normalizeNullableUuid(fabricanteId);
  if (!normalized) return null;
  const fabricante = await getFabricanteById(normalized, { accountId });
  if (String(fabricante.account_id || '') !== String(accountId || '')) {
    throw new ForbiddenError('Fabricante de outra conta nao permitido', { code: 'FABRICANTE_CROSS_TENANT', domain: 'produtos-catalogo' });
  }
  return fabricante;
}

function getProdutoFabricanteId(data = {}) {
  if (Object.prototype.hasOwnProperty.call(data, 'fabricante_id')) return data.fabricante_id;
  if (Object.prototype.hasOwnProperty.call(data, 'fabricanteId')) return data.fabricanteId;
  return undefined;
}

async function attachFabricanteData(item, options = {}) {
  if (!item) return item;
  const fabricanteId = item.fabricante_id || item.fabricanteId || null;
  if (!fabricanteId) {
    return { ...item, fabricante_id: null, fabricanteId: null, fabricante_nome: null, fabricante_logo_url: null, regras_comerciais_fabricante: null };
  }
  try {
    const fabricante = await getFabricanteById(fabricanteId, { accountId: options.accountId });
    const regras = {
      cnpj: fabricante.cnpj || null,
      pedido_minimo: fabricante.pedido_minimo_valor ?? fabricante.pedido_minimo ?? fabricante.valor_minimo_duplicata ?? 0,
      duplicata_minima: fabricante.valor_minimo_duplicata ?? fabricante.pedido_minimo ?? fabricante.pedido_minimo_valor ?? 0,
      comissao_padrao: fabricante.comissao_padrao_percentual ?? 0,
      condicoes_pagamento: Array.isArray(fabricante.condicoes_pagamento) ? fabricante.condicoes_pagamento : [],
      aceita_bonificacao: Boolean(fabricante.aceita_bonificacao),
      aceita_consignacao: Boolean(fabricante.aceita_consignacao),
      responsavel_comercial_nome: fabricante.responsavel_comercial_nome || null,
      responsavel_comercial_email: fabricante.responsavel_comercial_email || null
    };
    return {
      ...item,
      fabricante_id: fabricante.id || fabricanteId,
      fabricanteId: fabricante.id || fabricanteId,
      fabricante_nome: fabricante.nome || null,
      fabricante_logo_url: fabricante.logo_url || null,
      regras_comerciais_fabricante: regras
    };
  } catch {
    return { ...item, fabricante_id: fabricanteId, fabricanteId, fabricante_nome: null, fabricante_logo_url: null, regras_comerciais_fabricante: null };
  }
}

async function attachCategoriaData(item, options = {}) {
  if (!item) return item;
  const categoriaId = item.categoria_id || null;
  if (!categoriaId) return { ...item, categoria_id: null, categoria_nome: null, categoria_slug: null };
  try {
    const categoria = await getProdutoCategoriaById(categoriaId, { accountId: options.accountId });
    return { ...item, categoria_id: categoria.id, categoria: categoria.nome, categoria_nome: categoria.nome, categoria_slug: categoria.slug, categoria_parent_id: categoria.parent_id || null };
  } catch {
    return { ...item, categoria_id: categoriaId, categoria: item.categoria || null, categoria_nome: item.categoria || null, categoria_slug: null };
  }
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
    if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id);
    if (filters.marca) query = query.eq('marca', filters.marca);
    if (filters.search) {
      const search = String(filters.search).trim();
      if (search) query = query.or(`nome.ilike.%${search}%,sku.ilike.%${search}%,codigo.ilike.%${search}%,descricao.ilike.%${search}%,marca.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw new DatabaseError('Falha ao listar produtos', { details: error });
    const total = count || 0;
    const items = await Promise.all((data || []).map((item) => attachCategoriaData(item, { accountId }).then((x) => attachFabricanteData(x, { accountId }))));
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  const filtered = applyMemoryFilters(memoryProdutos, filters, accountId);
  const total = filtered.length;
  const from = (page - 1) * limit;
  const items = await Promise.all(filtered.slice(from, from + limit).map((item) => attachCategoriaData(item, { accountId }).then((x) => attachFabricanteData(x, { accountId }))));
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
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
    return attachFabricanteData(await attachCategoriaData(data, { accountId }), { accountId });
  }

  const item = memoryProdutos.find((produto) => produto.id === id && produto.account_id === accountId);
  if (!item) throw new NotFoundError('Produto nao encontrado', { domain: 'produtos-catalogo', code: 'PRODUTO_NOT_FOUND' });
  return attachFabricanteData(await attachCategoriaData(item, { accountId }), { accountId });
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
      .or(`nome.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,codigo.ilike.%${searchQuery}%,descricao.ilike.%${searchQuery}%,marca.ilike.%${searchQuery}%`)
      .limit(100);
    if (error) throw new DatabaseError('Falha na busca de produtos', { details: error });
    return { items: await Promise.all((data || []).map((item) => attachCategoriaData(item, { accountId }).then((x) => attachFabricanteData(x, { accountId })))), total: (data || []).length, query: searchQuery };
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

  const fabricante = await resolveFabricanteForProduto(accountId, getProdutoFabricanteId(data));
  const payload = {
    account_id: accountId,
    codigo: data.codigo || null,
    sku: data.sku || null,
    nome: data.nome,
    descricao: data.descricao || null,
    categoria_id: data.categoria_id || data.categoriaId || null,
    categoria: data.categoria || null,
    marca: data.marca || null,
    fabricante_id: fabricante?.id || normalizeNullableUuid(getProdutoFabricanteId(data)),
    ean: data.ean || null,
    ncm: data.ncm || null,
    preco: Number.isFinite(data.preco) ? data.preco : 0,
    preco_promocional: Number.isFinite(data.preco_promocional) ? data.preco_promocional : null,
    icms_percentual: Number.isFinite(data.icms_percentual) ? data.icms_percentual : 0,
    video_url: data.video_url || null,
    metadata: {
      ...(data.metadata || {}),
      ...(data.imagemUrl || data.imagem_url ? { imagem_url: data.imagemUrl || data.imagem_url || null } : {})
    },
    custo: Number.isFinite(data.custo) ? data.custo : null,
    estoque: Number.isFinite(data.estoque) ? data.estoque : 0,
    unidade: data.unidade || 'UN',
    ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
    tags: Array.isArray(data.tags) ? data.tags : []
  };

  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    try {
      const { data: inserted, error } = await supabase.from('produtos').insert(payload).select('*').single();
      if (error) throw error;
      return attachFabricanteData(inserted, { accountId });
    } catch (error) {
      console.error('[produtos] create failed', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint
      });
      throw new DatabaseError('Falha ao criar produto', { details: error });
    }
  }

  const item = { id: randomUUID(), ...payload, createdAt: new Date().toISOString() };
  memoryProdutos.push(item);
  return attachFabricanteData(item, { accountId });
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

  let fabricanteId;
  if (Object.prototype.hasOwnProperty.call(data, 'fabricante_id') || Object.prototype.hasOwnProperty.call(data, 'fabricanteId')) {
    const fabricante = await resolveFabricanteForProduto(accountId, getProdutoFabricanteId(data));
    fabricanteId = fabricante?.id || null;
  }

  const nextAtivo = statusRaw ? statusRaw === 'ativo' : (typeof data.ativo === 'boolean' ? data.ativo : undefined);
  const payload = {
    ...(nome !== undefined ? { nome } : {}),
    ...(data.descricao !== undefined ? { descricao: data.descricao || null } : {}),
    ...(data.sku !== undefined ? { sku: data.sku || null } : {}),
    ...(data.categoria_id !== undefined ? { categoria_id: data.categoria_id || null } : {}),
    ...(data.categoria !== undefined && data.categoria_id === undefined ? { categoria: data.categoria || null } : {}),
    ...(fabricanteId !== undefined ? { fabricante_id: fabricanteId, fabricanteId } : {}),
    ...(precoRaw !== undefined ? { preco: Number(precoRaw) } : {}),
    ...(data.preco_promocional !== undefined ? { preco_promocional: Number(data.preco_promocional) } : {}),
    ...(data.icms_percentual !== undefined ? { icms_percentual: Number(data.icms_percentual) } : {}),
    ...(data.video_url !== undefined ? { video_url: data.video_url || null } : {}),
    ...(data.imagemUrl !== undefined ? { imagemUrl: data.imagemUrl || null } : {}),
    ...(data.imagem_url !== undefined ? { imagemUrl: data.imagem_url || null } : {}),
    ...(statusRaw ? { status: statusRaw } : {}),
    ...(nextAtivo !== undefined ? { ativo: nextAtivo } : {})
  };

  if (getProdutosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('produtos').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar produto', { details: error });
    return attachFabricanteData(updated, { accountId });
  }

  const idx = memoryProdutos.findIndex((produto) => produto.id === id && produto.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Produto nao encontrado', { domain: 'produtos-catalogo', code: 'PRODUTO_NOT_FOUND' });
  memoryProdutos[idx] = { ...memoryProdutos[idx], ...payload, updatedAt: new Date().toISOString() };
  return attachFabricanteData(await attachCategoriaData(memoryProdutos[idx], { accountId }), { accountId });
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
