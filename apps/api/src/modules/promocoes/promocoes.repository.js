import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getProdutoById, listProdutoVariacoes } from '../produtos/produtos.repository.js';

const memoryPromocoes = [];
const memoryPromocaoVariacoes = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'promocoes' });
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return raw.slice(0, 10);
}

export function calcularPrecoPromocional(precoBase, percentualDesconto) {
  const base = Number(precoBase || 0);
  const desconto = Number(percentualDesconto || 0);
  if (!Number.isFinite(base) || !Number.isFinite(desconto)) return 0;
  return Math.max(0, Number((base - (base * desconto / 100)).toFixed(2)));
}

export function isPromocaoAtiva(promocao, dataReferencia = new Date()) {
  if (!promocao) return false;
  const ref = new Date(dataReferencia);
  const inicio = new Date(promocao.data_inicio);
  const fim = new Date(promocao.data_fim);
  return promocao.status === 'ativo' && !Number.isNaN(ref.getTime()) && ref >= inicio && ref <= fim;
}

function attachMeta(promocao, variacoes = []) {
  return {
    ...promocao,
    variacoesSelecionadas: variacoes,
    ativaAgora: isPromocaoAtiva(promocao)
  };
}

function normalizeRow(row) {
  return {
    ...row,
    percentual_desconto: Number(row.percentual_desconto),
    aplicar_em_todas_variacoes: Boolean(row.aplicar_em_todas_variacoes)
  };
}

async function resolveVariacoes(accountId, produtoId, variacaoIds = []) {
  const produtoVariacoes = await listProdutoVariacoes(produtoId, { accountId });
  const byId = new Map(produtoVariacoes.map((v) => [String(v.id), v]));
  return variacaoIds.map((id) => {
    const match = byId.get(String(id));
    if (!match) throw new BadRequestError('Variacao invalida para esta promocao', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    return match;
  });
}

function validatePayload(data = {}) {
  const percentual = Number(data.percentual_desconto);
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) throw new BadRequestError('Percentual de desconto invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  const inicio = normalizeDate(data.data_inicio);
  const fim = normalizeDate(data.data_fim);
  if (!inicio || !fim || new Date(inicio) > new Date(fim)) throw new BadRequestError('Periodo da promocao invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  return { percentual, inicio, fim };
}

export function getPromocoesRepositoryMode() {
  return { mode: isSupabaseConfigured() ? 'supabase' : 'memory' };
}

async function loadRows(accountId, produtoId = null) {
  const mode = getPromocoesRepositoryMode().mode;
  if (mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('produto_promocoes').select('*').eq('account_id', accountId).order('created_at', { ascending: false });
    if (produtoId) query = query.eq('produto_id', produtoId);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar promocoes', { details: error });
    const ids = (data || []).map((p) => p.id);
    const { data: links } = ids.length ? await supabase.from('produto_promocao_variacoes').select('*').eq('account_id', accountId).in('promocao_id', ids) : { data: [] };
    return (data || []).map((row) => attachMeta(normalizeRow(row), (links || []).filter((l) => l.promocao_id === row.id)));
  }
  return memoryPromocoes.filter((p) => p.account_id === accountId && (!produtoId || String(p.produto_id) === String(produtoId))).map((p) => attachMeta(normalizeRow(p), memoryPromocaoVariacoes.filter((l) => l.account_id === accountId && l.promocao_id === p.id)));
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
  const produtoId = String(data.produto_id || '').trim();
  if (!produtoId) throw new BadRequestError('Produto obrigatorio', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  await getProdutoById(produtoId, { accountId });
  const { percentual, inicio, fim } = validatePayload(data);
  const aplicarEmTodasVariacoes = data.aplicar_em_todas_variacoes !== false;
  const variacaoIds = Array.isArray(data.variacao_ids) ? data.variacao_ids.filter(Boolean) : [];
  if (!aplicarEmTodasVariacoes && !variacaoIds.length) throw new BadRequestError('Informe ao menos uma variacao', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  const selectedVariacoes = aplicarEmTodasVariacoes ? [] : await resolveVariacoes(accountId, produtoId, variacaoIds);
  const payload = { id: randomUUID(), account_id: accountId, produto_id: produtoId, nome: String(data.nome || '').trim(), descricao: data.descricao || null, percentual_desconto: percentual, data_inicio: inicio, data_fim: fim, status: String(data.status || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo', aplicar_em_todas_variacoes: aplicarEmTodasVariacoes, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (getPromocoesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: inserted, error } = await supabase.from('produto_promocoes').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar promocao', { details: error });
    if (!aplicarEmTodasVariacoes) {
      const links = selectedVariacoes.map((v) => ({ id: randomUUID(), account_id: accountId, promocao_id: inserted.id, produto_id: produtoId, variacao_id: v.id, created_at: new Date().toISOString() }));
      await supabase.from('produto_promocao_variacoes').insert(links);
    }
    return attachMeta(normalizeRow(inserted), selectedVariacoes);
  }
  memoryPromocoes.push(payload);
  if (!aplicarEmTodasVariacoes) {
    selectedVariacoes.forEach((v) => memoryPromocaoVariacoes.push({ id: randomUUID(), account_id: accountId, promocao_id: payload.id, produto_id: produtoId, variacao_id: v.id, created_at: new Date().toISOString() }));
  }
  return attachMeta(normalizeRow(payload), selectedVariacoes);
}

export async function updatePromocao(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = await getPromocaoById(id, { accountId });
  const payload = { ...current };
  if (data.nome !== undefined) payload.nome = String(data.nome || '').trim();
  if (data.descricao !== undefined) payload.descricao = data.descricao || null;
  if (data.percentual_desconto !== undefined) payload.percentual_desconto = validatePayload({ ...current, ...data }).percentual;
  if (data.data_inicio !== undefined || data.data_fim !== undefined) {
    const validated = validatePayload({ ...current, ...data });
    payload.data_inicio = validated.inicio; payload.data_fim = validated.fim;
  }
  if (data.status !== undefined) payload.status = String(data.status || '').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
  if (data.aplicar_em_todas_variacoes !== undefined) payload.aplicar_em_todas_variacoes = Boolean(data.aplicar_em_todas_variacoes);
  const variacaoIds = Array.isArray(data.variacao_ids) ? data.variacao_ids.filter(Boolean) : [];
  if (payload.aplicar_em_todas_variacoes === false && !variacaoIds.length && current.aplicar_em_todas_variacoes) throw new BadRequestError('Informe ao menos uma variacao', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  const selectedVariacoes = payload.aplicar_em_todas_variacoes ? [] : await resolveVariacoes(accountId, payload.produto_id, variacaoIds.length ? variacaoIds : current.variacoesSelecionadas.map((v) => v.id));
  payload.updated_at = new Date().toISOString();
  if (getPromocoesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase.from('produto_promocoes').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar promocao', { details: error });
    await supabase.from('produto_promocao_variacoes').delete().eq('promocao_id', id).eq('account_id', accountId);
    if (!payload.aplicar_em_todas_variacoes) {
      await supabase.from('produto_promocao_variacoes').insert(selectedVariacoes.map((v) => ({ id: randomUUID(), account_id: accountId, promocao_id: id, produto_id: payload.produto_id, variacao_id: v.id, created_at: new Date().toISOString() })));
    }
    return attachMeta(normalizeRow(updated), selectedVariacoes);
  }
  const idx = memoryPromocoes.findIndex((row) => row.id === id && row.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Promocao nao encontrada', { domain: 'promocoes', code: 'PROMOCAO_NOT_FOUND' });
  memoryPromocoes[idx] = payload;
  for (let i = memoryPromocaoVariacoes.length - 1; i >= 0; i -= 1) if (memoryPromocaoVariacoes[i].promocao_id === id && memoryPromocaoVariacoes[i].account_id === accountId) memoryPromocaoVariacoes.splice(i, 1);
  if (!payload.aplicar_em_todas_variacoes) selectedVariacoes.forEach((v) => memoryPromocaoVariacoes.push({ id: randomUUID(), account_id: accountId, promocao_id: id, produto_id: payload.produto_id, variacao_id: v.id, created_at: new Date().toISOString() }));
  return attachMeta(normalizeRow(payload), selectedVariacoes);
}

export async function deletePromocao(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return updatePromocao(id, { status: 'inativo' }, { accountId });
}

export function __resetMemoryPromocoesForTests() { memoryPromocoes.length = 0; memoryPromocaoVariacoes.length = 0; }

