import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
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

function normalizeVariationLink(row = {}) {
  const rawPercentual = row.percentual_desconto;
  return {
    ...row,
    percentual_desconto: rawPercentual === null || rawPercentual === undefined || rawPercentual === '' ? null : Number(rawPercentual)
  };
}

async function resolveVariacoes(accountId, produtoId, variacaoIds = []) {
  const produtoVariacoes = await listProdutoVariacoes(produtoId, { accountId });
  const byId = new Map(produtoVariacoes.map((v) => [String(v.id), v]));
  return variacaoIds.map((id) => {
    const match = byId.get(String(id));
    if (!match) throw new ValidationError('Variacao invalida para esta promocao', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    return match;
  });
}

function validatePercentual(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError('Percentual de desconto invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    return null;
  }
  const percentual = Number(value);
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) throw new ValidationError('Percentual de desconto invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  return percentual;
}

function validatePayload(data = {}, { percentualRequired = false } = {}) {
  const percentual = validatePercentual(data.percentual_desconto, { required: percentualRequired });
  const inicio = normalizeDate(data.data_inicio);
  const fim = normalizeDate(data.data_fim);
  if (!inicio || !fim || new Date(inicio) > new Date(fim)) throw new ValidationError('Periodo da promocao invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  return { percentual, inicio, fim };
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
    if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) throw new ValidationError('Percentual de desconto invalido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
    return { variacaoId, percentualDesconto: percentual };
  }
  return {
    variacaoId,
    percentualDesconto: null
  };
}

function hasValidIndividualPercentual(item = {}) {
  const rawPercentual = item.percentualDesconto ?? item.percentual_desconto;
  if (rawPercentual === undefined || rawPercentual === null || rawPercentual === '') return false;
  const percentual = Number(rawPercentual);
  return Number.isFinite(percentual) && percentual > 0 && percentual <= 100;
}

function resolveVariacaoPayload(data = {}) {
  const raw = Array.isArray(data.variacoesSelecionadas)
    ? data.variacoesSelecionadas
    : Array.isArray(data.variacao_ids)
      ? data.variacao_ids
      : [];
  return raw.map(normalizeVariacaoSelecionada).filter(Boolean);
}

function buildVariacaoLinks({ accountId, promocaoId, produtoId, selectedVariacoes = [], percentualGlobal = null }) {
  return selectedVariacoes.map((variacao) => ({
    id: randomUUID(),
    account_id: accountId,
    promocao_id: promocaoId,
    produto_id: produtoId,
    variacao_id: variacao.variacaoId,
    percentual_desconto: variacao.percentualDesconto ?? percentualGlobal,
    created_at: new Date().toISOString()
  }));
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
    return (data || []).map((row) => attachMeta(normalizeRow(row), (links || []).filter((l) => l.promocao_id === row.id).map(normalizeVariationLink)));
  }
  return memoryPromocoes.filter((p) => p.account_id === accountId && (!produtoId || String(p.produto_id) === String(produtoId))).map((p) => attachMeta(normalizeRow(p), memoryPromocaoVariacoes.filter((l) => l.account_id === accountId && l.promocao_id === p.id).map(normalizeVariationLink)));
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
  if (!produtoId) throw new ValidationError('Produto obrigatorio', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  await getProdutoById(produtoId, { accountId });
  const aplicarEmTodasVariacoes = data.aplicar_em_todas_variacoes !== false;
  const { percentual, inicio, fim } = validatePayload(data, { percentualRequired: aplicarEmTodasVariacoes });
  const selectedVariacoesInput = resolveVariacaoPayload(data);
  const hasAnyIndividualPercentual = selectedVariacoesInput.some(hasValidIndividualPercentual);
  if (!aplicarEmTodasVariacoes && !percentual && !hasAnyIndividualPercentual) throw new ValidationError('Informe percentual global ou ao menos uma variacao com desconto valido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  if (!aplicarEmTodasVariacoes && !selectedVariacoesInput.length) throw new ValidationError('Informe ao menos uma variacao', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  const selectedVariacoes = aplicarEmTodasVariacoes ? [] : await resolveVariacoes(accountId, produtoId, selectedVariacoesInput.map((item) => item.variacaoId));
  const selectedVariacoesPayload = selectedVariacoesInput.map((item) => ({ variacaoId: item.variacaoId, percentualDesconto: item.percentualDesconto ?? null }));
  const payload = { id: randomUUID(), account_id: accountId, produto_id: produtoId, nome: String(data.nome || '').trim(), descricao: data.descricao || null, percentual_desconto: percentual ?? null, data_inicio: inicio, data_fim: fim, status: String(data.status || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo', aplicar_em_todas_variacoes: aplicarEmTodasVariacoes, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (getPromocoesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: inserted, error } = await supabase.from('produto_promocoes').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar promocao', { details: error });
    if (!aplicarEmTodasVariacoes) {
      const links = buildVariacaoLinks({ accountId, promocaoId: inserted.id, produtoId, selectedVariacoes: selectedVariacoesPayload, percentualGlobal: percentual ?? null });
      await supabase.from('produto_promocao_variacoes').insert(links);
    }
    return attachMeta(normalizeRow(inserted), selectedVariacoesPayload.map((item) => ({ variacao_id: item.variacaoId, percentual_desconto: item.percentualDesconto })));
  }
  memoryPromocoes.push(payload);
  if (!aplicarEmTodasVariacoes) {
    buildVariacaoLinks({ accountId, promocaoId: payload.id, produtoId, selectedVariacoes: selectedVariacoesPayload, percentualGlobal: percentual ?? null }).forEach((link) => memoryPromocaoVariacoes.push(link));
  }
  return attachMeta(normalizeRow(payload), selectedVariacoesPayload.map((item) => ({ variacao_id: item.variacaoId, percentual_desconto: item.percentualDesconto })));
}

export async function updatePromocao(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = await getPromocaoById(id, { accountId });
  const payload = { ...current };
  if (data.nome !== undefined) payload.nome = String(data.nome || '').trim();
  if (data.descricao !== undefined) payload.descricao = data.descricao || null;
  if (data.percentual_desconto !== undefined) payload.percentual_desconto = validatePercentual(data.percentual_desconto, { required: current.aplicar_em_todas_variacoes });
  if (data.data_inicio !== undefined || data.data_fim !== undefined) {
    const validated = validatePayload({ ...current, ...data }, { percentualRequired: current.aplicar_em_todas_variacoes });
    payload.data_inicio = validated.inicio; payload.data_fim = validated.fim;
  }
  if (data.status !== undefined) payload.status = String(data.status || '').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
  if (data.aplicar_em_todas_variacoes !== undefined) payload.aplicar_em_todas_variacoes = Boolean(data.aplicar_em_todas_variacoes);
  const selectedVariacoesInput = resolveVariacaoPayload(data);
  const currentVariacoes = Array.isArray(current.variacoesSelecionadas) ? current.variacoesSelecionadas : [];
  const selectedVariacoes = payload.aplicar_em_todas_variacoes
    ? []
    : await resolveVariacoes(accountId, payload.produto_id, selectedVariacoesInput.length ? selectedVariacoesInput.map((item) => item.variacaoId) : currentVariacoes.map((v) => v.variacao_id || v.variacaoId || v.id));
  const selectedVariacoesById = new Map(selectedVariacoesInput.map((item) => [String(item.variacaoId), item]));
  const selectedVariacoesPayload = (selectedVariacoesInput.length ? selectedVariacoesInput : selectedVariacoes.map((v) => ({ variacaoId: v.id, percentualDesconto: null }))).map((item) => ({ variacaoId: item.variacaoId, percentualDesconto: item.percentualDesconto ?? null }));
  const percentualGlobal = payload.percentual_desconto ?? null;
  const hasAnyIndividualPercentual = selectedVariacoesInput.some(hasValidIndividualPercentual);
  if (payload.aplicar_em_todas_variacoes === false && !percentualGlobal && !hasAnyIndividualPercentual) throw new ValidationError('Informe percentual global ou ao menos uma variacao com desconto valido', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  if (payload.aplicar_em_todas_variacoes === false && !selectedVariacoes.length) throw new ValidationError('Informe ao menos uma variacao', { code: 'VALIDATION_ERROR', domain: 'promocoes' });
  payload.updated_at = new Date().toISOString();
  if (getPromocoesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase.from('produto_promocoes').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar promocao', { details: error });
    await supabase.from('produto_promocao_variacoes').delete().eq('promocao_id', id).eq('account_id', accountId);
    if (!payload.aplicar_em_todas_variacoes) {
      await supabase.from('produto_promocao_variacoes').insert(buildVariacaoLinks({ accountId, promocaoId: id, produtoId: payload.produto_id, selectedVariacoes: selectedVariacoesPayload, percentualGlobal }));
    }
    return attachMeta(normalizeRow(updated), selectedVariacoesPayload.map((item) => ({ variacao_id: item.variacaoId, percentual_desconto: item.percentualDesconto })));
  }
  const idx = memoryPromocoes.findIndex((row) => row.id === id && row.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Promocao nao encontrada', { domain: 'promocoes', code: 'PROMOCAO_NOT_FOUND' });
  memoryPromocoes[idx] = payload;
  for (let i = memoryPromocaoVariacoes.length - 1; i >= 0; i -= 1) if (memoryPromocaoVariacoes[i].promocao_id === id && memoryPromocaoVariacoes[i].account_id === accountId) memoryPromocaoVariacoes.splice(i, 1);
  if (!payload.aplicar_em_todas_variacoes) buildVariacaoLinks({ accountId, promocaoId: id, produtoId: payload.produto_id, selectedVariacoes: selectedVariacoesPayload, percentualGlobal }).forEach((link) => memoryPromocaoVariacoes.push(link));
  return attachMeta(normalizeRow(payload), selectedVariacoesPayload.map((item) => ({ variacao_id: item.variacaoId, percentual_desconto: item.percentualDesconto })));
}

export async function deletePromocao(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return updatePromocao(id, { status: 'inativo' }, { accountId });
}

export function __resetMemoryPromocoesForTests() { memoryPromocoes.length = 0; memoryPromocaoVariacoes.length = 0; }
