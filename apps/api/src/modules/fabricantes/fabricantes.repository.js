import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryFabricantes = [];
const memoryCondicoes = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'fabricantes' });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20;
  return { page, limit: Math.min(rawLimit, 100) };
}

function debugRepository(action, payload) {
  if (env.NODE_ENV === 'production') return;
  console.debug(`[fabricantes.repository] ${action}`, payload);
}

function isSupabaseMode() {
  return isSupabaseConfigured();
}

function findDuplicateFabricante(accountId, payload, excludeId = null) {
  const cnpj = payload.cnpj || null;
  const nome = normalizeText(payload.nome);
  return memoryFabricantes.find((item) => item.account_id === accountId && item.id !== excludeId && ((cnpj && item.cnpj === cnpj) || normalizeText(item.nome) === nome));
}

function findDuplicateCondicao(accountId, fabricanteId, payload, excludeId = null) {
  const nome = normalizeText(payload.nome);
  const codigo = String(payload.codigo || '').trim().toLowerCase() || null;
  return memoryCondicoes.find((item) => item.account_id === accountId && item.fabricante_id === fabricanteId && item.id !== excludeId && ((codigo && item.codigo && item.codigo.toLowerCase() === codigo) || normalizeText(item.nome) === nome));
}

export async function listFabricantes(filters = {}, options = {}) {
  const { page, limit } = normalizePagination(filters);
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  debugRepository('listFabricantes', { accountId, filters });

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('fabricantes').select('*', { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) {
      const search = String(filters.search).trim();
      if (search) query = query.or(`nome.ilike.%${search}%,razao_social.ilike.%${search}%,cnpj.ilike.%${search}%`);
    }
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw new DatabaseError('Falha ao listar fabricantes', { details: error });
    const total = count || 0;
    return { items: data || [], total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  const items = memoryFabricantes.filter((item) => item.account_id === accountId);
  const q = String(filters.search || '').trim().toLowerCase();
  const filtered = items.filter((item) => (!filters.status || item.status === filters.status) && (!q || [item.nome, item.razao_social, item.cnpj].some((v) => String(v || '').toLowerCase().includes(q))));
  const total = filtered.length;
  const from = (page - 1) * limit;
  return { items: filtered.slice(from, from + limit), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getFabricanteById(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('fabricantes').select('*').eq('account_id', accountId).eq('id', id).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar fabricante', { details: error });
    if (!data) throw new NotFoundError('Fabricante nao encontrado', { domain: 'fabricantes', code: 'FABRICANTE_NOT_FOUND' });
    return data;
  }

  const item = memoryFabricantes.find((row) => row.id === id && row.account_id === accountId);
  if (!item) throw new NotFoundError('Fabricante nao encontrado', { domain: 'fabricantes', code: 'FABRICANTE_NOT_FOUND' });
  return item;
}

export async function createFabricante(data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  for (const field of ['pedido_minimo', 'boleto_minimo', 'comissao_padrao_percentual']) {
    if (data[field] !== undefined && data[field] !== null && Number(data[field]) < 0) {
      throw new BadRequestError('Valores invalidos', { domain: 'fabricantes' });
    }
  }
  const payload = {
    account_id: accountId,
    nome: String(data.nome || '').trim(),
    razao_social: data.razao_social || null,
    cnpj: normalizeCnpj(data.cnpj),
    logo_url: data.logo_url || null,
    status: data.status === 'inativo' ? 'inativo' : 'ativo',
    pedido_minimo: normalizeNumber(data.pedido_minimo, 0),
    boleto_minimo: normalizeNumber(data.boleto_minimo, 0),
    comissao_padrao_percentual: normalizeNumber(data.comissao_padrao_percentual, 0),
    observacoes: data.observacoes || null
  };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
  if (findDuplicateFabricante(accountId, payload)) throw new ConflictError('Fabricante duplicado', { domain: 'fabricantes', code: 'FABRICANTE_DUPLICADO' });

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: inserted, error } = await supabase.from('fabricantes').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar fabricante', { details: error });
    return inserted;
  }

  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryFabricantes.push(item);
  return item;
}

export async function updateFabricante(id, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  for (const field of ['pedido_minimo', 'boleto_minimo', 'comissao_padrao_percentual']) {
    if (data[field] !== undefined && data[field] !== null && Number(data[field]) < 0) {
      throw new BadRequestError('Valores invalidos', { domain: 'fabricantes' });
    }
  }

  if (isSupabaseMode()) {
    const current = await getFabricanteById(id, { accountId });
    const payload = {
      ...(data.nome !== undefined ? { nome: String(data.nome || '').trim() } : {}),
      ...(data.razao_social !== undefined ? { razao_social: data.razao_social || null } : {}),
      ...(data.cnpj !== undefined ? { cnpj: normalizeCnpj(data.cnpj) } : {}),
      ...(data.logo_url !== undefined ? { logo_url: data.logo_url || null } : {}),
      ...(data.status !== undefined ? { status: data.status === 'inativo' ? 'inativo' : 'ativo' } : {}),
      ...(data.pedido_minimo !== undefined ? { pedido_minimo: normalizeNumber(data.pedido_minimo, 0) } : {}),
      ...(data.boleto_minimo !== undefined ? { boleto_minimo: normalizeNumber(data.boleto_minimo, 0) } : {}),
      ...(data.comissao_padrao_percentual !== undefined ? { comissao_padrao_percentual: normalizeNumber(data.comissao_padrao_percentual, 0) } : {}),
      ...(data.observacoes !== undefined ? { observacoes: data.observacoes || null } : {}),
      updated_at: new Date().toISOString()
    };
    const next = { ...current, ...payload };
    if (!next.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
    if (findDuplicateFabricante(accountId, next, id)) throw new ConflictError('Fabricante duplicado', { domain: 'fabricantes', code: 'FABRICANTE_DUPLICADO' });
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('fabricantes').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar fabricante', { details: error });
    return updated;
  }

  const idx = memoryFabricantes.findIndex((row) => row.id === id && row.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Fabricante nao encontrado', { domain: 'fabricantes', code: 'FABRICANTE_NOT_FOUND' });
  const current = memoryFabricantes[idx];
  const payload = {
    ...current,
    ...(data.nome !== undefined ? { nome: String(data.nome || '').trim() } : {}),
    ...(data.razao_social !== undefined ? { razao_social: data.razao_social || null } : {}),
    ...(data.cnpj !== undefined ? { cnpj: normalizeCnpj(data.cnpj) } : {}),
    ...(data.logo_url !== undefined ? { logo_url: data.logo_url || null } : {}),
    ...(data.status !== undefined ? { status: data.status === 'inativo' ? 'inativo' : 'ativo' } : {}),
    ...(data.pedido_minimo !== undefined ? { pedido_minimo: normalizeNumber(data.pedido_minimo, 0) } : {}),
    ...(data.boleto_minimo !== undefined ? { boleto_minimo: normalizeNumber(data.boleto_minimo, 0) } : {}),
    ...(data.comissao_padrao_percentual !== undefined ? { comissao_padrao_percentual: normalizeNumber(data.comissao_padrao_percentual, 0) } : {}),
    ...(data.observacoes !== undefined ? { observacoes: data.observacoes || null } : {}),
    updated_at: new Date().toISOString()
  };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
  if (findDuplicateFabricante(accountId, payload, id)) throw new ConflictError('Fabricante duplicado', { domain: 'fabricantes', code: 'FABRICANTE_DUPLICADO' });
  memoryFabricantes[idx] = payload;
  return payload;
}

export async function listCondicoesPagamento(fabricanteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('fabricante_condicoes_pagamento').select('*').eq('account_id', accountId).eq('fabricante_id', fabricanteId).order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar condicoes de pagamento', { details: error });
    return { items: data || [], total: (data || []).length };
  }

  return { items: memoryCondicoes.filter((item) => item.account_id === accountId && item.fabricante_id === fabricanteId), total: memoryCondicoes.length };
}

export async function createCondicaoPagamento(fabricanteId, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getFabricanteById(fabricanteId, { accountId });
  for (const field of ['parcelas', 'prazo_medio_dias', 'valor_minimo', 'percentual_acrescimo']) {
    if (data[field] !== undefined && data[field] !== null && Number(data[field]) < 0) {
      throw new BadRequestError('Valores invalidos', { domain: 'fabricantes' });
    }
  }
  const payload = {
    account_id: accountId,
    fabricante_id: fabricanteId,
    nome: String(data.nome || '').trim(),
    codigo: data.codigo || null,
    parcelas: Math.max(1, Math.floor(normalizeNumber(data.parcelas, 1))),
    prazo_medio_dias: normalizeNumber(data.prazo_medio_dias, 0),
    valor_minimo: normalizeNumber(data.valor_minimo, 0),
    percentual_acrescimo: normalizeNumber(data.percentual_acrescimo, 0),
    ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
    observacoes: data.observacoes || null
  };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
  if (findDuplicateCondicao(accountId, fabricanteId, payload)) throw new ConflictError('Condicao duplicada', { domain: 'fabricantes', code: 'CONDICAO_DUPLICADA' });

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: inserted, error } = await supabase.from('fabricante_condicoes_pagamento').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar condicao de pagamento', { details: error });
    return inserted;
  }

  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryCondicoes.push(item);
  return item;
}

export async function updateCondicaoPagamento(fabricanteId, condicaoId, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  for (const field of ['parcelas', 'prazo_medio_dias', 'valor_minimo', 'percentual_acrescimo']) {
    if (data[field] !== undefined && data[field] !== null && Number(data[field]) < 0) {
      throw new BadRequestError('Valores invalidos', { domain: 'fabricantes' });
    }
  }

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const current = (await listCondicoesPagamento(fabricanteId, { accountId })).items.find((item) => item.id === condicaoId);
    if (!current) throw new NotFoundError('Condicao nao encontrada', { domain: 'fabricantes', code: 'CONDICAO_NOT_FOUND' });
    const payload = {
      ...(data.nome !== undefined ? { nome: String(data.nome || '').trim() } : {}),
      ...(data.codigo !== undefined ? { codigo: data.codigo || null } : {}),
      ...(data.parcelas !== undefined ? { parcelas: Math.max(1, Math.floor(normalizeNumber(data.parcelas, 1))) } : {}),
      ...(data.prazo_medio_dias !== undefined ? { prazo_medio_dias: normalizeNumber(data.prazo_medio_dias, 0) } : {}),
      ...(data.valor_minimo !== undefined ? { valor_minimo: normalizeNumber(data.valor_minimo, 0) } : {}),
      ...(data.percentual_acrescimo !== undefined ? { percentual_acrescimo: normalizeNumber(data.percentual_acrescimo, 0) } : {}),
      ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}),
      ...(data.observacoes !== undefined ? { observacoes: data.observacoes || null } : {}),
      updated_at: new Date().toISOString()
    };
    const next = { ...current, ...payload };
    if (!next.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
    if (findDuplicateCondicao(accountId, fabricanteId, next, condicaoId)) throw new ConflictError('Condicao duplicada', { domain: 'fabricantes', code: 'CONDICAO_DUPLICADA' });
    const { data: updated, error } = await supabase.from('fabricante_condicoes_pagamento').update(payload).eq('id', condicaoId).eq('account_id', accountId).eq('fabricante_id', fabricanteId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar condicao de pagamento', { details: error });
    return updated;
  }

  const idx = memoryCondicoes.findIndex((row) => row.id === condicaoId && row.account_id === accountId && row.fabricante_id === fabricanteId);
  if (idx < 0) throw new NotFoundError('Condicao nao encontrada', { domain: 'fabricantes', code: 'CONDICAO_NOT_FOUND' });
  const current = memoryCondicoes[idx];
  const payload = {
    ...current,
    ...(data.nome !== undefined ? { nome: String(data.nome || '').trim() } : {}),
    ...(data.codigo !== undefined ? { codigo: data.codigo || null } : {}),
    ...(data.parcelas !== undefined ? { parcelas: Math.max(1, Math.floor(normalizeNumber(data.parcelas, 1))) } : {}),
    ...(data.prazo_medio_dias !== undefined ? { prazo_medio_dias: normalizeNumber(data.prazo_medio_dias, 0) } : {}),
    ...(data.valor_minimo !== undefined ? { valor_minimo: normalizeNumber(data.valor_minimo, 0) } : {}),
    ...(data.percentual_acrescimo !== undefined ? { percentual_acrescimo: normalizeNumber(data.percentual_acrescimo, 0) } : {}),
    ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}),
    ...(data.observacoes !== undefined ? { observacoes: data.observacoes || null } : {}),
    updated_at: new Date().toISOString()
  };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
  if (findDuplicateCondicao(accountId, fabricanteId, payload, condicaoId)) throw new ConflictError('Condicao duplicada', { domain: 'fabricantes', code: 'CONDICAO_DUPLICADA' });
  memoryCondicoes[idx] = payload;
  return payload;
}

export function __resetMemoryFabricantesForTests() {
  memoryFabricantes.length = 0;
  memoryCondicoes.length = 0;
}

export function __loadMemoryFabricantes(items = []) {
  memoryFabricantes.length = 0;
  memoryCondicoes.length = 0;
  for (const item of items) memoryFabricantes.push({ ...item });
}
