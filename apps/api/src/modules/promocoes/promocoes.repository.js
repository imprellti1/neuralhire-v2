import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getProdutoById, listProdutoVariacoes } from '../produtos/produtos.repository.js';
import { compareDateOnly, dateToDateOnly, todayDateOnly } from './promocoes.date.js';

const memoryPromocoes = [];
const memoryPromocaoProdutos = [];
const memoryPromocaoVariacoes = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'promocoes' });
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? raw.slice(0, 10) : null;
}

function validatePercentual(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError('Percentual de desconto invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    return null;
  }
  const percentual = Number(value);
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
    throw new ValidationError('Percentual de desconto invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  }
  return percentual;
}

function validatePeriodo(data = {}) {
  const inicio = normalizeDate(data.data_inicio);
  const fim = normalizeDate(data.data_fim);
  if (!inicio || !fim || compareDateOnly(inicio, fim) > 0) {
    throw new ValidationError('Periodo da promocao invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  }
  return { inicio, fim };
}

export function calcularPrecoPromocional(precoBase, percentualDesconto) {
  const base = Number(precoBase || 0);
  const desconto = Number(percentualDesconto || 0);
  if (!Number.isFinite(base) || !Number.isFinite(desconto)) return 0;
  return Math.max(0, Number((base - (base * desconto / 100)).toFixed(2)));
}

export function isPromocaoAtiva(promocao, dataReferencia = new Date()) {
  if (!promocao) return false;
  const ref = dateToDateOnly(dataReferencia) || todayDateOnly();
  const inicio = normalizeDate(promocao.data_inicio);
  const fim = normalizeDate(promocao.data_fim);
  return promocao.status === 'ativo' && !!inicio && !!fim && compareDateOnly(inicio, ref) <= 0 && compareDateOnly(ref, fim) <= 0;
}

function normalizeRow(row) {
  return {
    ...row,
    percentual_desconto: row.percentual_desconto === null || row.percentual_desconto === undefined || row.percentual_desconto === '' ? null : Number(row.percentual_desconto),
    aplicar_em_todas_variacoes: Boolean(row.aplicar_em_todas_variacoes)
  };
}

function normalizeVariationLink(row = {}) {
  return {
    ...row,
    percentual_desconto: row.percentual_desconto === null || row.percentual_desconto === undefined || row.percentual_desconto === '' ? null : Number(row.percentual_desconto)
  };
}

function normalizeEstoque(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasEstoqueDisponivel(variacao = {}) {
  const hasField = ['estoque', 'stock', 'quantidade', 'qtd_estoque'].some((key) => Object.prototype.hasOwnProperty.call(variacao || {}, key));
  if (!hasField) return true;
  const estoque = normalizeEstoque(variacao.estoque ?? variacao.stock ?? variacao.quantidade ?? variacao.qtd_estoque);
  return Number.isFinite(estoque) && estoque > 0;
}

function getLegacyVariacoes(links = [], rowId = null, accountId = null) {
  return links
    .filter((link) => link.account_id === accountId && link.promocao_id === rowId && !link.promocao_produto_id)
    .map(normalizeVariationLink);
}

function normalizeVariacaoSelecionada(item = {}) {
  if (item === null || item === undefined) return null;
  if (typeof item === 'string' || typeof item === 'number') {
    const variacaoId = String(item).trim();
    return variacaoId ? { variacaoId, percentualDesconto: null } : null;
  }
  const variacaoId = String(item.variacaoId || item.variacao_id || item.id || '').trim();
  if (!variacaoId) return null;
  const rawPercentual = item.percentualDesconto ?? item.percentual_desconto;
  if (rawPercentual !== undefined && rawPercentual !== null && rawPercentual !== '') {
    const percentual = Number(rawPercentual);
    if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
      throw new ValidationError('Percentual de desconto invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    }
    return { variacaoId, percentualDesconto: percentual };
  }
  return { variacaoId, percentualDesconto: null };
}

function hasValidIndividualPercentual(item = {}) {
  const rawPercentual = item.percentualDesconto ?? item.percentual_desconto;
  if (rawPercentual === undefined || rawPercentual === null || rawPercentual === '') return false;
  const percentual = Number(rawPercentual);
  return Number.isFinite(percentual) && percentual > 0 && percentual <= 100;
}

function extractVariacoes(data = {}) {
  const raw = Array.isArray(data.variacoes)
    ? data.variacoes
    : Array.isArray(data.variacoesSelecionadas)
      ? data.variacoesSelecionadas
      : Array.isArray(data.variacao_ids)
        ? data.variacao_ids
        : [];
  return raw.map(normalizeVariacaoSelecionada).filter(Boolean);
}

async function resolveProdutosInput(accountId, data = {}) {
  const legacyProdutoId = String(data.produto_id || '').trim();
  const produtosRaw = Array.isArray(data.produtos) && data.produtos.length
    ? data.produtos
    : legacyProdutoId
      ? [{
          produto_id: legacyProdutoId,
          aplicar_em_todas_variacoes: data.aplicar_em_todas_variacoes,
          percentual_desconto: data.percentual_desconto,
          variacoes: extractVariacoes(data)
        }]
      : [];
  if (!produtosRaw.length) throw new ValidationError('Produto obrigatorio', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  const produtos = [];
  for (const item of produtosRaw) {
    const produtoId = String(item.produto_id || item.id || '').trim();
    if (!produtoId) throw new ValidationError('Produto invalido na promocao', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    const variacoesInput = Array.isArray(item.variacoes) && item.variacoes.length
      ? item.variacoes
      : Array.isArray(item.variacoesSelecionadas) && item.variacoesSelecionadas.length
        ? item.variacoesSelecionadas
        : Array.isArray(item.variacao_ids) && item.variacao_ids.length
          ? item.variacao_ids
          : [];
    const produto = await getProdutoById(produtoId, { accountId });
    produtos.push({
      id: produto.id,
      nome: produto.nome || null,
      descricao: produto.descricao || null,
      aplicar_em_todas_variacoes: item.aplicar_em_todas_variacoes !== false,
      percentual_desconto: validatePercentual(item.percentual_desconto),
      variacoes: variacoesInput
    });
  }
  return produtos;
}

async function resolveVariacoesPorProduto(accountId, produto) {
  const variacoesInput = extractVariacoes(produto);
  const aplicarEmTodas = produto.aplicar_em_todas_variacoes !== false;
  const hasAnyIndividualPercentual = variacoesInput.some(hasValidIndividualPercentual);
  if (!aplicarEmTodas && !variacoesInput.length) {
    throw new ValidationError(`Informe ao menos uma variacao para o produto ${produto.id}`, { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  }
  if (!aplicarEmTodas && !produto.percentual_desconto && !hasAnyIndividualPercentual) {
    throw new ValidationError(`Informe percentual global ou ao menos uma variacao com desconto valido para o produto ${produto.id}`, { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  }
  const produtoVariacoes = await listProdutoVariacoes(produto.id, { accountId });
  const byId = new Map(produtoVariacoes.map((v) => [String(v.id), v]));
  const selectedVariacoes = aplicarEmTodas ? produtoVariacoes : variacoesInput.map((item) => {
    if (item?.produto_id && String(item.produto_id) !== String(produto.id)) {
      throw new ValidationError(`Variacao invalida para o produto ${produto.id}`, { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    }
    const match = byId.get(String(item.variacaoId));
    if (!match) throw new ValidationError(`Variacao invalida para o produto ${produto.id}`, { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    if (String(match.produto_id || produto.id) !== String(produto.id)) {
      throw new ValidationError(`Variacao invalida para o produto ${produto.id}`, { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    }
    if (!hasEstoqueDisponivel(match)) {
      throw new ValidationError('Variação sem estoque disponível para promoção.', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    }
    return match;
  });
  if (aplicarEmTodas) {
    const invalid = selectedVariacoes.find((variacao) => !hasEstoqueDisponivel(variacao));
    if (invalid) {
      throw new ValidationError('Variação sem estoque disponível para promoção.', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    }
  }
  const selectedVariacoesPayload = aplicarEmTodas
    ? selectedVariacoes.map((v) => ({ variacaoId: v.id, percentualDesconto: null }))
    : variacoesInput.map((item) => ({ variacaoId: item.variacaoId, percentualDesconto: item.percentualDesconto ?? null }));
  return { selectedVariacoes, selectedVariacoesPayload };
}

function resolveProdutosParaAtualizacao(current, data = {}) {
  if (Array.isArray(data.produtos) && data.produtos.length) return data.produtos;
  if (Array.isArray(current?.produtos) && current.produtos.length) {
    return current.produtos.map((produto) => ({
      ...produto,
      aplicar_em_todas_variacoes: data.aplicar_em_todas_variacoes ?? produto.aplicar_em_todas_variacoes,
      percentual_desconto: data.percentual_desconto !== undefined ? validatePercentual(data.percentual_desconto) : produto.percentual_desconto,
      variacoes: data.variacoesSelecionadas !== undefined ? data.variacoesSelecionadas : produto.variacoes
    }));
  }
  return [];
}

function attachMeta(promocao, variacoes = []) {
  return { ...promocao, variacoesSelecionadas: variacoes, ativaAgora: isPromocaoAtiva(promocao) };
}

async function attachProdutoData(promocao, accountId) {
  const produtosInput = Array.isArray(promocao?.produtos) ? promocao.produtos : [];
  const produtos = [];
  if (produtosInput.length) {
    for (const item of produtosInput) {
      try {
        const produto = await getProdutoById(item.id, { accountId });
        produtos.push({ id: produto.id, nome: produto.nome || item.nome || null, descricao: produto.descricao || item.descricao || null, aplicar_em_todas_variacoes: item.aplicar_em_todas_variacoes !== false, percentual_desconto: item.percentual_desconto ?? null, variacoes: Array.isArray(item.variacoes) ? item.variacoes : [] });
      } catch {
        produtos.push({ id: item.id, nome: item.nome || null, descricao: item.descricao || null, aplicar_em_todas_variacoes: item.aplicar_em_todas_variacoes !== false, percentual_desconto: item.percentual_desconto ?? null, variacoes: Array.isArray(item.variacoes) ? item.variacoes : [] });
      }
    }
  } else if (promocao?.produto_id) {
    try {
      const produto = await getProdutoById(promocao.produto_id, { accountId });
      produtos.push({ id: produto.id, nome: produto.nome || null, descricao: produto.descricao || null, aplicar_em_todas_variacoes: promocao.aplicar_em_todas_variacoes !== false, percentual_desconto: promocao.percentual_desconto ?? null, variacoes: [] });
    } catch {
      produtos.push({ id: promocao.produto_id, nome: promocao.produto_nome || promocao.produto?.nome || null, descricao: promocao.produto_descricao || promocao.produto?.descricao || null, aplicar_em_todas_variacoes: promocao.aplicar_em_todas_variacoes !== false, percentual_desconto: promocao.percentual_desconto ?? null, variacoes: [] });
    }
  }
  return { ...promocao, produto: produtos[0] || null, produtos };
}

function throwSupabasePromocaoError(message, error, context = {}) {
  console.error(`[promocoes] ${message}`, { code: error?.code || null, message: error?.message || null, details: error?.details || null, hint: error?.hint || null, context });
  throw new DatabaseError(message, { details: error });
}

function buildProdutoPromocaoRows({ accountId, promocaoId, produtos }) {
  return produtos.map((produto) => ({
    id: randomUUID(),
    account_id: accountId,
    promocao_id: promocaoId,
    produto_id: produto.id,
    aplicar_em_todas_variacoes: produto.aplicar_em_todas_variacoes !== false,
    percentual_desconto: produto.percentual_desconto ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
}

export function getPromocoesRepositoryMode() {
  return { mode: isSupabaseConfigured() ? 'supabase' : 'memory' };
}

async function loadRows(accountId, produtoId = null) {
  if (getPromocoesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('produto_promocoes').select('*').eq('account_id', accountId).order('created_at', { ascending: false });
    if (produtoId) query = query.eq('produto_id', produtoId);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar promocoes', { details: error });
    const ids = (data || []).map((p) => p.id);
    const { data: produtoLinks } = ids.length ? await supabase.from('produto_promocao_produtos').select('*').eq('account_id', accountId).in('promocao_id', ids) : { data: [] };
    const { data: links } = ids.length ? await supabase.from('produto_promocao_variacoes').select('*').eq('account_id', accountId).in('promocao_id', ids) : { data: [] };
    return Promise.all((data || []).map(async (row) => {
      const legacyVariacoes = getLegacyVariacoes(links || [], row.id, accountId);
      const produtos = (produtoLinks || []).filter((l) => l.promocao_id === row.id).map((link) => ({
        id: link.produto_id,
        aplicar_em_todas_variacoes: link.aplicar_em_todas_variacoes,
        percentual_desconto: link.percentual_desconto,
        variacoes: (links || []).filter((l) => l.promocao_produto_id === link.id).map(normalizeVariationLink)
      }));
      const promocao = attachMeta(normalizeRow(row), legacyVariacoes);
      promocao.produtos = produtos.length ? produtos : (row.produto_id ? [{ id: row.produto_id, aplicar_em_todas_variacoes: row.aplicar_em_todas_variacoes, percentual_desconto: row.percentual_desconto, variacoes: legacyVariacoes }] : []);
      return attachProdutoData(promocao, accountId);
    }));
  }

  return Promise.all(memoryPromocoes.filter((p) => p.account_id === accountId && (!produtoId || String(p.produto_id) === String(produtoId) || memoryPromocaoProdutos.some((pp) => pp.promocao_id === p.id && String(pp.produto_id) === String(produtoId)))).map(async (row) => {
    const legacyVariacoes = getLegacyVariacoes(memoryPromocaoVariacoes, row.id, accountId);
    const produtos = memoryPromocaoProdutos.filter((pp) => pp.account_id === accountId && pp.promocao_id === row.id).map((link) => ({
      id: link.produto_id,
      aplicar_em_todas_variacoes: link.aplicar_em_todas_variacoes,
      percentual_desconto: link.percentual_desconto,
      variacoes: memoryPromocaoVariacoes.filter((l) => l.account_id === accountId && l.promocao_produto_id === link.id).map(normalizeVariationLink)
    }));
    const promocao = attachMeta(normalizeRow(row), legacyVariacoes);
    promocao.produtos = produtos.length ? produtos : (row.produto_id ? [{ id: row.produto_id, aplicar_em_todas_variacoes: row.aplicar_em_todas_variacoes, percentual_desconto: row.percentual_desconto, variacoes: legacyVariacoes }] : []);
    return attachProdutoData(promocao, accountId);
  }));
}

export async function listPromocoes(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const items = await loadRows(accountId, filters.produto_id || null);
  return { items, total: items.length };
}

export async function getPromocaoById(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const items = await loadRows(accountId);
  const item = items.find((row) => String(row.id) === String(id));
  if (!item) throw new NotFoundError('Promocao nao encontrada', { domain: 'promocoes', code: 'PROMOCAO_NOT_FOUND' });
  return item;
}

export async function listPromocoesDoProduto(produtoId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getProdutoById(produtoId, { accountId });
  return listPromocoes({ produto_id: produtoId }, { accountId });
}

export async function createPromocao(data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const { percentual, inicio, fim } = (() => {
    const validatedPercentual = validatePercentual(data.percentual_desconto);
    const { inicio, fim } = validatePeriodo(data);
    return { percentual: validatedPercentual, inicio, fim };
  })();
  const produtos = await resolveProdutosInput(accountId, data);
  const payload = { id: randomUUID(), account_id: accountId, produto_id: produtos[0].id, nome: String(data.nome || '').trim(), descricao: data.descricao || null, percentual_desconto: percentual ?? null, data_inicio: inicio, data_fim: fim, status: String(data.status || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo', aplicar_em_todas_variacoes: produtos[0].aplicar_em_todas_variacoes, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  const produtoRows = [];
  const variationRows = [];
  const createdVariacoes = [];
  for (const produto of produtos) {
    const { selectedVariacoesPayload } = await resolveVariacoesPorProduto(accountId, produto);
    const produtoRowId = randomUUID();
    produtoRows.push({ id: produtoRowId, account_id: accountId, promocao_id: payload.id, produto_id: produto.id, aplicar_em_todas_variacoes: produto.aplicar_em_todas_variacoes, percentual_desconto: produto.percentual_desconto, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    selectedVariacoesPayload.forEach((variacao) => {
      createdVariacoes.push({ variacao_id: variacao.variacaoId, percentual_desconto: variacao.percentualDesconto ?? produto.percentual_desconto ?? percentual ?? null });
      variationRows.push({ id: randomUUID(), account_id: accountId, promocao_id: payload.id, promocao_produto_id: produtoRowId, produto_id: produto.id, variacao_id: variacao.variacaoId, percentual_desconto: variacao.percentualDesconto ?? produto.percentual_desconto ?? percentual ?? null, created_at: new Date().toISOString() });
    });
  }

  if (getPromocoesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: inserted, error } = await supabase.from('produto_promocoes').insert(payload).select('*').single();
    if (error) throwSupabasePromocaoError('Falha ao criar promocao', error, { table: 'produto_promocoes', payload });
    const produtoInsertRows = produtoRows.map((row) => ({ ...row, promocao_id: inserted.id }));
    const { data: insertedProdutos, error: produtosError } = produtoInsertRows.length ? await supabase.from('produto_promocao_produtos').insert(produtoInsertRows).select('*') : { data: [] };
    if (produtosError) throwSupabasePromocaoError('Falha ao criar produtos da promocao', produtosError, { table: 'produto_promocao_produtos', produtoInsertRows });
    const produtoRowMap = new Map((insertedProdutos || []).map((row) => [String(row.produto_id), row.id]));
    const variationInsertRows = variationRows.map((row) => ({ ...row, promocao_id: inserted.id, promocao_produto_id: produtoRowMap.get(String(row.produto_id)) || row.promocao_produto_id }));
    if (variationInsertRows.length) {
      const { error: linkError } = await supabase.from('produto_promocao_variacoes').insert(variationInsertRows);
      if (linkError) throwSupabasePromocaoError('Falha ao criar variacoes da promocao', linkError, { table: 'produto_promocao_variacoes', variationInsertRows });
    }
    return getPromocaoById(inserted.id, { accountId });
  }

  memoryPromocoes.push(payload);
  memoryPromocaoProdutos.push(...produtoRows);
  memoryPromocaoVariacoes.push(...variationRows);
  return getPromocaoById(payload.id, { accountId });
}

export async function updatePromocao(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = await getPromocaoById(id, { accountId });
  const payload = { ...current };
  if (data.nome !== undefined) payload.nome = String(data.nome || '').trim();
  if (data.descricao !== undefined) payload.descricao = data.descricao || null;
  if (data.percentual_desconto !== undefined) payload.percentual_desconto = validatePercentual(data.percentual_desconto);
  if (data.data_inicio !== undefined || data.data_fim !== undefined) {
    const { inicio, fim } = validatePeriodo({ ...current, ...data });
    payload.data_inicio = inicio;
    payload.data_fim = fim;
  }
  if (data.status !== undefined) payload.status = String(data.status || '').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
  payload.updated_at = new Date().toISOString();

  const produtosInput = resolveProdutosParaAtualizacao(current, data);
  const produtos = produtosInput.length ? await resolveProdutosInput(accountId, { ...data, produtos: produtosInput }) : [];
  payload.aplicar_em_todas_variacoes = produtos[0]?.aplicar_em_todas_variacoes !== false;
  payload.produto_id = produtos[0]?.id || payload.produto_id || null;

  if (getPromocoesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase.from('produto_promocoes').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar promocao', { details: error });
    await supabase.from('produto_promocao_variacoes').delete().eq('promocao_id', id).eq('account_id', accountId);
    await supabase.from('produto_promocao_produtos').delete().eq('promocao_id', id).eq('account_id', accountId);
    const produtoInsertRows = buildProdutoPromocaoRows({ accountId, promocaoId: id, produtos });
    const { data: insertedProdutos, error: produtosError } = produtoInsertRows.length ? await supabase.from('produto_promocao_produtos').insert(produtoInsertRows).select('*') : { data: [] };
    if (produtosError) throwSupabasePromocaoError('Falha ao criar produtos da promocao', produtosError, { table: 'produto_promocao_produtos', produtoInsertRows });
    const produtoRowMap = new Map((insertedProdutos || []).map((row) => [String(row.produto_id), row.id]));
    const variationInsertRows = [];
    for (const produto of produtos) {
      const { selectedVariacoesPayload } = await resolveVariacoesPorProduto(accountId, produto);
      selectedVariacoesPayload.forEach((variacao) => variationInsertRows.push({ id: randomUUID(), account_id: accountId, promocao_id: id, promocao_produto_id: produtoRowMap.get(String(produto.id)) || null, produto_id: produto.id, variacao_id: variacao.variacaoId, percentual_desconto: variacao.percentualDesconto ?? produto.percentual_desconto ?? payload.percentual_desconto ?? null, created_at: new Date().toISOString() }));
    }
    if (variationInsertRows.length) await supabase.from('produto_promocao_variacoes').insert(variationInsertRows);
    return getPromocaoById(id, { accountId });
  }

  const idx = memoryPromocoes.findIndex((row) => row.id === id && row.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Promocao nao encontrada', { domain: 'promocoes', code: 'PROMOCAO_NOT_FOUND' });
  memoryPromocoes[idx] = payload;
  for (let i = memoryPromocaoProdutos.length - 1; i >= 0; i -= 1) if (memoryPromocaoProdutos[i].promocao_id === id && memoryPromocaoProdutos[i].account_id === accountId) memoryPromocaoProdutos.splice(i, 1);
  for (let i = memoryPromocaoVariacoes.length - 1; i >= 0; i -= 1) if (memoryPromocaoVariacoes[i].promocao_id === id && memoryPromocaoVariacoes[i].account_id === accountId) memoryPromocaoVariacoes.splice(i, 1);
  const produtoRows = buildProdutoPromocaoRows({ accountId, promocaoId: id, produtos });
  memoryPromocaoProdutos.push(...produtoRows);
  for (const produto of produtos) {
    const { selectedVariacoesPayload } = await resolveVariacoesPorProduto(accountId, produto);
    const produtoRow = produtoRows.find((row) => String(row.produto_id) === String(produto.id));
    selectedVariacoesPayload.forEach((variacao) => memoryPromocaoVariacoes.push({ id: randomUUID(), account_id: accountId, promocao_id: id, promocao_produto_id: produtoRow?.id || null, produto_id: produto.id, variacao_id: variacao.variacaoId, percentual_desconto: variacao.percentualDesconto ?? produto.percentual_desconto ?? payload.percentual_desconto ?? null, created_at: new Date().toISOString() }));
  }
  return getPromocaoById(id, { accountId });
}

export async function deletePromocao(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return updatePromocao(id, { status: 'inativo' }, { accountId });
}

export function __resetMemoryPromocoesForTests() {
  memoryPromocoes.length = 0;
  memoryPromocaoProdutos.length = 0;
  memoryPromocaoVariacoes.length = 0;
}
