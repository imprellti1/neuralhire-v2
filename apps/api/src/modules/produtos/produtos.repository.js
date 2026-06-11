import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { env } from '../../config/env.js';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';
import { getProdutoCategoriaById } from '../produto-categorias/produto-categorias.repository.js';

const memoryProdutos = [];
const PRODUTO_VARIACOES_SELECT_FIELDS = 'id, account_id, produto_id, sku, nome, valor, cor, grade, estoque_atual, preco, preco_promocional, multiplo_venda, ativo, imagem_url, imagem_path, created_at, updated_at';
const VARIACAO_IMAGE_BUCKET = 'produto-variacoes-imagens';
const MAX_VARIACAO_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_VARIACAO_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_VARIACAO_IMAGE_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp']
]);

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

const PRODUTOS_UPDATE_SUPABASE_FIELDS = new Set([
  'codigo',
  'sku',
  'nome',
  'descricao',
  'categoria_id',
  'categoria',
  'marca',
  'fabricante_id',
  'ean',
  'ncm',
  'preco',
  'preco_promocional',
  'icms_percentual',
  'multiplo_venda',
  'video_url',
  'metadata',
  'custo',
  'estoque',
  'unidade',
  'ativo',
  'tags'
]);

function normalizeProdutoUpdatePayload(payload = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (PRODUTOS_UPDATE_SUPABASE_FIELDS.has(key)) {
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizeMultiploVenda(value, { required = false } = {}) {
  if (value === undefined) return 1;
  if (value === null || value === '') throw new BadRequestError('Multiplo de venda invalido', { code: 'VALIDATION_ERROR', domain: 'produtos-catalogo' });
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new BadRequestError('Multiplo de venda invalido', { code: 'VALIDATION_ERROR', domain: 'produtos-catalogo' });
  }
  return numeric;
}

function pickMultiploVenda(data = {}) {
  if (Object.prototype.hasOwnProperty.call(data, 'multiplo_venda')) return data.multiplo_venda;
  if (Object.prototype.hasOwnProperty.call(data, 'multiploVenda')) return data.multiploVenda;
  return undefined;
}

export function __normalizeProdutoUpdatePayloadForTests(payload = {}) {
  return normalizeProdutoUpdatePayload(payload);
}

async function attachFabricanteData(item, options = {}) {
  if (!item) return item;
  const fabricanteId = item.fabricante_id || item.fabricanteId || null;
  const imagemUrl = item?.imagemUrl || item?.imagem_url || item?.image_url || item?.foto || item?.foto_url || item?.metadata?.imagem_url || item?.metadata?.image_url || item?.metadata?.foto_url || null;
  if (!fabricanteId) {
    return { ...item, fabricante_id: null, fabricanteId: null, fabricante_nome: null, fabricante_logo_url: null, imagemUrl, imagem_url: imagemUrl, image_url: imagemUrl, foto: imagemUrl, foto_url: imagemUrl, regras_comerciais_fabricante: null };
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
      imagemUrl,
      imagem_url: imagemUrl,
      image_url: imagemUrl,
      foto: imagemUrl,
      foto_url: imagemUrl,
      regras_comerciais_fabricante: regras
    };
  } catch {
    return { ...item, fabricante_id: fabricanteId, fabricanteId, fabricante_nome: null, fabricante_logo_url: null, imagemUrl, imagem_url: imagemUrl, image_url: imagemUrl, foto: imagemUrl, foto_url: imagemUrl, regras_comerciais_fabricante: null };
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

async function attachPromocaoResumo(item, options = {}) {
  if (!item?.id) return item;
  try {
    const { listPromocoesDoProduto } = await import('../promocoes/promocoes.repository.js');
    const result = await listPromocoesDoProduto(item.id, { accountId: options.accountId });
    const promocoes = Array.isArray(result?.items) ? result.items : [];
    const activePromocoes = promocoes.filter((promocao) => promocao?.ativaAgora);
    const temPromocaoVariacao = activePromocoes.some((promocao) => {
      if (promocao?.aplicar_em_todas_variacoes) return true;
      const produtos = Array.isArray(promocao?.produtos) ? promocao.produtos : [];
      const productLink = produtos.find((produto) => String(produto.id) === String(item.id));
      const variacoes = Array.isArray(productLink?.variacoes) ? productLink.variacoes : Array.isArray(promocao?.variacoesSelecionadas) ? promocao.variacoesSelecionadas : [];
      return variacoes.length > 0;
    });
    return {
      ...item,
      tem_promocao_variacao: temPromocaoVariacao,
      temPromocaoVariacao: temPromocaoVariacao,
      promocao_ativa: activePromocoes.length > 0,
      promocao_ativa_nome: activePromocoes[0]?.nome || null,
      promocao_ativa_data_inicio: activePromocoes[0]?.data_inicio || null,
      promocao_ativa_data_fim: activePromocoes[0]?.data_fim || null,
      promocao_ativa_percentual_desconto: activePromocoes[0]?.percentual_desconto ?? null
    };
  } catch {
    return item;
  }
}

function normalizePromocaoResumoMap(promocoes = [], produtoIds = []) {
  const map = new Map();
  const produtoIdSet = new Set((Array.isArray(produtoIds) ? produtoIds : []).map((id) => String(id)));
  for (const produtoId of produtoIdSet) {
    map.set(produtoId, {
      tem_promocao_variacao: false,
      temPromocaoVariacao: false,
      promocao_ativa: false,
      promocao_ativa_nome: null,
      promocao_ativa_data_inicio: null,
      promocao_ativa_data_fim: null,
      promocao_ativa_percentual_desconto: null
    });
  }
  for (const promocao of Array.isArray(promocoes) ? promocoes : []) {
    if (!promocao?.ativaAgora) continue;
    const produtos = Array.isArray(promocao.produtos) ? promocao.produtos : [];
    for (const produto of produtos) {
      const produtoId = String(produto?.id || '');
      if (!produtoIdSet.has(produtoId)) continue;
      const current = map.get(produtoId) || {
        tem_promocao_variacao: false,
        temPromocaoVariacao: false,
        promocao_ativa: false,
        promocao_ativa_nome: null,
        promocao_ativa_data_inicio: null,
        promocao_ativa_data_fim: null,
        promocao_ativa_percentual_desconto: null
      };
      const variacoes = Array.isArray(produto?.variacoes) ? produto.variacoes : [];
      const temPromocaoVariacao = current.temPromocaoVariacao || Boolean(promocao?.aplicar_em_todas_variacoes) || variacoes.length > 0;
      map.set(produtoId, {
        tem_promocao_variacao: temPromocaoVariacao,
        temPromocaoVariacao: temPromocaoVariacao,
        promocao_ativa: true,
        promocao_ativa_nome: current.promocao_ativa_nome || promocao?.nome || null,
        promocao_ativa_data_inicio: current.promocao_ativa_data_inicio || promocao?.data_inicio || null,
        promocao_ativa_data_fim: current.promocao_ativa_data_fim || promocao?.data_fim || null,
        promocao_ativa_percentual_desconto: current.promocao_ativa_percentual_desconto ?? promocao?.percentual_desconto ?? null
      });
    }
  }
  return map;
}

async function attachPromocaoResumoEmLote(items = [], options = {}) {
  const productIds = (Array.isArray(items) ? items : []).map((item) => item?.id).filter(Boolean);
  if (!productIds.length) return items;
  try {
    const { listPromocoes } = await import('../promocoes/promocoes.repository.js');
    const result = await listPromocoes({}, { accountId: options.accountId });
    const resumoMap = normalizePromocaoResumoMap(result?.items || [], productIds);
    return items.map((item) => {
      const resumo = resumoMap.get(String(item.id));
      return resumo ? { ...item, ...resumo } : {
        ...item,
        tem_promocao_variacao: false,
        temPromocaoVariacao: false,
        promocao_ativa: false,
        promocao_ativa_nome: null,
        promocao_ativa_data_inicio: null,
        promocao_ativa_data_fim: null,
        promocao_ativa_percentual_desconto: null
      };
    });
  } catch {
    return items;
  }
}

export function getProdutosRepositoryMode() {
  return {
    mode: isSupabaseConfigured() ? 'supabase' : 'memory',
    supabaseConfigured: isSupabaseConfigured()
  };
}

export function __getProdutoVariacoesSelectFieldsForTests() {
  return PRODUTO_VARIACOES_SELECT_FIELDS;
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
    const itemsBase = await Promise.all((data || []).map((item) => attachCategoriaData(item, { accountId }).then((x) => attachFabricanteData(x, { accountId }))));
    const items = await attachPromocaoResumoEmLote(itemsBase, { accountId });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  const filtered = applyMemoryFilters(memoryProdutos, filters, accountId);
  const total = filtered.length;
  const from = (page - 1) * limit;
  const itemsBase = await Promise.all(filtered.slice(from, from + limit).map((item) => attachCategoriaData(item, { accountId }).then((x) => attachFabricanteData(x, { accountId }))));
  const items = await attachPromocaoResumoEmLote(itemsBase, { accountId });
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
  return attachPromocaoResumo(await attachFabricanteData(await attachCategoriaData(data, { accountId }), { accountId }), { accountId });
  }

  const item = memoryProdutos.find((produto) => produto.id === id && produto.account_id === accountId);
  if (!item) throw new NotFoundError('Produto nao encontrado', { domain: 'produtos-catalogo', code: 'PRODUTO_NOT_FOUND' });
  return attachPromocaoResumo(await attachFabricanteData(await attachCategoriaData(item, { accountId }), { accountId }), { accountId });
}

export async function getProdutoBaseById(id, options = {}) {
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

function normalizeProdutoVariacao(item = {}) {
  const imagemUrl = item.imagem_url || null;
  return {
    ...item,
    imagemUrl,
    imagem_url: imagemUrl,
    imagem_path: item.imagem_path || null,
    estoqueAtual: Number(item.estoque_atual || 0),
    ativo: Boolean(item.ativo),
    cor: item.cor || null,
    tamanho: item.grade || null
  };
}

function safeName(value) {
  const fileName = path.basename(String(value || ''), path.extname(String(value || '')));
  return fileName.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'imagem';
}

function normalizeVariationImageUpload(upload) {
  if (!upload || typeof upload !== 'object') return null;
  const fileName = String(upload.fileName || upload.filename || '').trim();
  const mimeType = String(upload.mimeType || upload.contentType || '').trim().toLowerCase();
  const base64 = String(upload.base64 || upload.data || '').trim();
  const size = Number(upload.size || 0);
  if (!fileName || !mimeType || !base64) return null;
  if (!ALLOWED_VARIACAO_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new BadRequestError('Formato de imagem invalido', { domain: 'produtos-catalogo', code: 'INVALID_FILE_TYPE' });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_VARIACAO_IMAGE_BYTES) {
    throw new BadRequestError('Arquivo excede o limite permitido', { domain: 'produtos-catalogo', code: 'PAYLOAD_TOO_LARGE' });
  }
  return { fileName, mimeType, base64, size };
}

async function ensureVariacaoImageBucket(supabase) {
  try {
    const { data } = await supabase.storage.listBuckets();
    if (!Array.isArray(data) || !data.find((bucket) => bucket.name === VARIACAO_IMAGE_BUCKET)) {
      await supabase.storage.createBucket(VARIACAO_IMAGE_BUCKET, { public: true, fileSizeLimit: MAX_VARIACAO_IMAGE_BYTES });
    }
  } catch {}
}

async function uploadVariacaoImageToStorage({ accountId, produtoId, variacaoId, upload }) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  await ensureVariacaoImageBucket(supabase);
  const normalized = normalizeVariationImageUpload(upload);
  if (!normalized) throw new BadRequestError('Imagem invalida', { domain: 'produtos-catalogo' });
  const ext = ALLOWED_VARIACAO_IMAGE_EXTENSIONS.get(normalized.mimeType);
  const objectPath = `${accountId}/${produtoId}/${variacaoId}/${Date.now()}-${safeName(normalized.fileName)}.${ext}`;
  const bytes = Buffer.from(normalized.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const { error } = await supabase.storage.from(VARIACAO_IMAGE_BUCKET).upload(objectPath, bytes, { upsert: true, contentType: normalized.mimeType });
  if (error) throw new DatabaseError('Falha ao enviar imagem da variacao', { details: error });
  const { data } = supabase.storage.from(VARIACAO_IMAGE_BUCKET).getPublicUrl(objectPath);
  return { url: data?.publicUrl || null, storage_path: objectPath };
}

async function findVariacaoById(accountId, variacaoId) {
  const repositoryMode = getProdutosRepositoryMode();
  if (repositoryMode.mode !== 'supabase') {
    for (const produto of memoryProdutos) {
      if (produto.account_id !== accountId) continue;
      const rawVariations = Array.isArray(produto.variacoes) ? produto.variacoes : Array.isArray(produto.variations) ? produto.variations : Array.isArray(produto.produto_variacoes) ? produto.produto_variacoes : [];
      const match = rawVariations.find((item) => String(item?.id) === String(variacaoId));
      if (match) return { ...match, produto_id: produto.id };
    }
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  const { data, error } = await supabase
    .from('produto_variacoes')
    .select(PRODUTO_VARIACOES_SELECT_FIELDS)
    .eq('account_id', accountId)
    .eq('id', variacaoId)
    .maybeSingle();
  if (error) throw new DatabaseError('Falha ao buscar variacao', { details: error });
  return data || null;
}

async function assertVariacaoScope(accountId, produtoId, variacaoId) {
  const match = await findVariacaoById(accountId, variacaoId);
  if (!match) throw new NotFoundError('Variacao nao encontrada', { domain: 'produtos-catalogo', code: 'VARIACAO_NOT_FOUND' });
  if (produtoId && String(match.produto_id || '') !== String(produtoId || '')) {
    throw new NotFoundError('Variacao nao encontrada', { domain: 'produtos-catalogo', code: 'VARIACAO_NOT_FOUND' });
  }
  return match;
}

export async function listProdutoVariacoes(produtoId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getProdutoById(produtoId, { accountId });

  const repositoryMode = getProdutosRepositoryMode();
  debugRepository('listProdutoVariacoes', { repositoryMode, accountId, produtoId });

  if (repositoryMode.mode !== 'supabase') {
    const item = memoryProdutos.find((produto) => produto.id === produtoId && produto.account_id === accountId);
    if (!item) return [];
    const rawVariations = Array.isArray(item.variacoes) ? item.variacoes : Array.isArray(item.variations) ? item.variations : Array.isArray(item.produto_variacoes) ? item.produto_variacoes : [];
    return rawVariations.map(normalizeProdutoVariacao);
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');

  const { data, error } = await supabase
    .from('produto_variacoes')
    .select(PRODUTO_VARIACOES_SELECT_FIELDS)
    .eq('account_id', accountId)
    .eq('produto_id', produtoId)
    .order('created_at', { ascending: true });
  if (error) throw new DatabaseError('Falha ao listar variacoes do produto', { details: error });
  return (data || []).map(normalizeProdutoVariacao);
}

export async function updateProdutoVariacaoImagem(produtoId, variacaoId, upload, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const scopedVariation = await assertVariacaoScope(accountId, produtoId, variacaoId);
  const resolvedProdutoId = scopedVariation.produto_id || produtoId;
  const supabase = getSupabaseClient();
  if (!supabase) {
    const normalized = normalizeVariationImageUpload(upload);
    const updatedVariation = normalizeProdutoVariacao({
      ...scopedVariation,
      imagem_url: `memory://${accountId}/${resolvedProdutoId}/${variacaoId}/${safeName(normalized.fileName)}`,
      imagem_path: `memory/${accountId}/${resolvedProdutoId}/${variacaoId}/${safeName(normalized.fileName)}`
    });
    const idx = memoryProdutos.findIndex((produto) => produto.account_id === accountId && String(produto.id) === String(resolvedProdutoId));
    if (idx >= 0) {
      const product = memoryProdutos[idx];
      const rawVariations = Array.isArray(product.variacoes) ? product.variacoes : Array.isArray(product.variations) ? product.variations : Array.isArray(product.produto_variacoes) ? product.produto_variacoes : [];
      const nextVariations = rawVariations.map((variation) => String(variation.id) === String(variacaoId) ? { ...variation, imagem_url: updatedVariation.imagem_url, imagem_path: updatedVariation.imagem_path } : variation);
      memoryProdutos[idx] = { ...product, variacoes: nextVariations, variations: nextVariations, produto_variacoes: nextVariations, updatedAt: new Date().toISOString() };
    }
    return updatedVariation;
  }
  const uploaded = await uploadVariacaoImageToStorage({ accountId, produtoId: resolvedProdutoId, variacaoId, upload });
  const { data: updated, error } = await supabase
    .from('produto_variacoes')
    .update({ imagem_url: uploaded.url, imagem_path: uploaded.storage_path, updated_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('produto_id', resolvedProdutoId)
    .eq('id', variacaoId)
    .select(PRODUTO_VARIACOES_SELECT_FIELDS)
    .maybeSingle();
  if (error) throw new DatabaseError('Falha ao atualizar imagem da variacao', { details: error });
  if (!updated) throw new NotFoundError('Variacao nao encontrada', { domain: 'produtos-catalogo', code: 'VARIACAO_NOT_FOUND' });
  return normalizeProdutoVariacao(updated);
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
    multiplo_venda: normalizeMultiploVenda(pickMultiploVenda(data)),
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
  const multiploVendaRaw = pickMultiploVenda(data);
  const multiploVenda = multiploVendaRaw !== undefined ? normalizeMultiploVenda(multiploVendaRaw, { required: true }) : undefined;

  let fabricanteId;
  if (Object.prototype.hasOwnProperty.call(data, 'fabricante_id') || Object.prototype.hasOwnProperty.call(data, 'fabricanteId')) {
    const fabricante = await resolveFabricanteForProduto(accountId, getProdutoFabricanteId(data));
    fabricanteId = fabricante?.id || null;
  }

  const nextAtivo = statusRaw ? statusRaw === 'ativo' : (typeof data.ativo === 'boolean' ? data.ativo : undefined);
  const nextStatus = statusRaw || (nextAtivo !== undefined ? (nextAtivo ? 'ativo' : 'inativo') : undefined);
  const nextImageUrl = data.imagemUrl ?? data.imagem_url ?? data.image_url ?? data.foto ?? data.foto_url;
  const nextMetadata = nextImageUrl !== undefined
    ? { ...(data.metadata || {}), imagem_url: nextImageUrl || null }
    : undefined;
  const payload = {
    ...(nome !== undefined ? { nome } : {}),
    ...(data.descricao !== undefined ? { descricao: data.descricao || null } : {}),
    ...(data.sku !== undefined ? { sku: data.sku || null } : {}),
    ...(data.categoria_id !== undefined ? { categoria_id: data.categoria_id || null } : {}),
    ...(data.categoria !== undefined && data.categoria_id === undefined ? { categoria: data.categoria || null } : {}),
    ...(fabricanteId !== undefined ? { fabricante_id: fabricanteId } : {}),
    ...(precoRaw !== undefined ? { preco: Number(precoRaw) } : {}),
    ...(data.preco_promocional !== undefined ? { preco_promocional: Number(data.preco_promocional) } : {}),
    ...(data.icms_percentual !== undefined ? { icms_percentual: Number(data.icms_percentual) } : {}),
    ...(multiploVenda !== undefined ? { multiplo_venda: multiploVenda } : {}),
    ...(data.video_url !== undefined ? { video_url: data.video_url || null } : {}),
    ...(nextMetadata ? { metadata: nextMetadata } : {}),
    ...(nextAtivo !== undefined ? { ativo: nextAtivo } : {})
  };

  if (getProdutosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    try {
      const supabasePayload = normalizeProdutoUpdatePayload(payload);
      const { data: updated, error } = await supabase.from('produtos').update(supabasePayload).eq('id', id).eq('account_id', accountId).select('*').single();
      if (error) throw error;
      return attachFabricanteData({ ...updated, ...(nextStatus !== undefined ? { status: nextStatus } : {}), ...(nextAtivo !== undefined ? { ativo: nextAtivo } : {}) }, { accountId });
    } catch (error) {
      console.error('[produtos] update failed', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint
      });
      throw new DatabaseError('Falha ao atualizar produto', { details: error });
    }
  }

  const idx = memoryProdutos.findIndex((produto) => produto.id === id && produto.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Produto nao encontrado', { domain: 'produtos-catalogo', code: 'PRODUTO_NOT_FOUND' });
  memoryProdutos[idx] = { ...memoryProdutos[idx], ...payload, ...(nextStatus !== undefined ? { status: nextStatus } : {}), ...(nextAtivo !== undefined ? { ativo: nextAtivo } : {}), updatedAt: new Date().toISOString() };
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
