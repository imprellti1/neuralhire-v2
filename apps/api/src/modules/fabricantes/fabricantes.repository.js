import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getVendedorById } from '../vendedores/vendedores.repository.js';

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

function normalizeNonNegativeNumber(value, field) {
  const num = normalizeNumber(value, 0);
  if (num < 0) throw new BadRequestError(`Valor invalido para ${field}`, { domain: 'fabricantes', code: 'NEGATIVE_VALUE' });
  return num;
}

function normalizePercent(value) {
  const num = normalizeNonNegativeNumber(value, 'comissao_padrao_percentual');
  if (num > 100) throw new BadRequestError('Comissao padrao percentual invalida', { domain: 'fabricantes', code: 'PERCENT_OUT_OF_RANGE' });
  return num;
}

function normalizeBoolean(value, field) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return undefined;
  throw new BadRequestError(`Tipo invalido para ${field}`, { domain: 'fabricantes', code: 'BOOLEAN_INVALID' });
}

function normalizeNullableUuid(value) {
  const raw = String(value || '').trim();
  return raw || null;
}

function composeEnderecoCompleto(data = {}) {
  const parts = [
    [data.logradouro, data.numero].filter(Boolean).join(', ').trim(),
    data.complemento,
    [data.bairro, data.cidade, data.uf].filter(Boolean).join(' - ').trim(),
    data.cep
  ].filter((part) => String(part || '').trim());
  return parts.join(' | ') || null;
}

function sanitizeLogoUrl(value) {
  const logoUrl = String(value || '').trim();
  if (!logoUrl) return null;
  return logoUrl.startsWith('blob:') ? null : logoUrl;
}

const FABRICANTES_LOGO_BUCKET = 'fabricantes-logos';
const ALLOWED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function normalizeLogoUpload(upload) {
  if (!upload || typeof upload !== 'object') return null;
  const fileName = String(upload.fileName || upload.filename || '').trim();
  const mimeType = String(upload.mimeType || upload.contentType || '').trim().toLowerCase();
  const base64 = String(upload.base64 || upload.data || '').trim();
  if (!fileName || !base64 || !mimeType) return null;
  if (!ALLOWED_LOGO_MIME_TYPES.has(mimeType)) return null;
  return { fileName, mimeType, base64 };
}

async function ensureLogoBucket(supabase) {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = Array.isArray(buckets) ? buckets.find((bucket) => bucket.name === FABRICANTES_LOGO_BUCKET) : null;
    if (existing) return;
    if (typeof supabase.storage.createBucket === 'function') {
      await supabase.storage.createBucket(FABRICANTES_LOGO_BUCKET, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024
      });
    }
  } catch {
    // If bucket setup fails, uploads can still be skipped safely.
  }
}

async function uploadFabricanteLogo({ supabase, accountId, fabricanteId, upload }) {
  const normalized = normalizeLogoUpload(upload);
  if (!supabase || !accountId || !fabricanteId || !normalized) return null;
  try {
    await ensureLogoBucket(supabase);
    const ext = normalized.mimeType === 'image/png' ? 'png' : normalized.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const path = `fabricantes/${accountId}/${fabricanteId}/logo-${Date.now()}.${ext}`;
    const bytes = Buffer.from(normalized.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const { error } = await supabase.storage.from(FABRICANTES_LOGO_BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: normalized.mimeType
    });
    if (error) {
      logSupabaseFailure('uploadFabricanteLogo', error, { account_id: accountId, fabricante_id: fabricanteId, path, mimeType: normalized.mimeType });
      return null;
    }
    const { data } = supabase.storage.from(FABRICANTES_LOGO_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl || null;
    return sanitizeLogoUrl(publicUrl);
  } catch (error) {
    logSupabaseFailure('uploadFabricanteLogo', error, { account_id: accountId, fabricante_id: fabricanteId, upload: { fileName: normalized.fileName, mimeType: normalized.mimeType } });
    return null;
  }
}

export async function updateFabricanteLogo(id, upload, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const supabase = getSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  const current = await getFabricanteById(id, { accountId });
  const normalized = normalizeLogoUpload(upload);
  if (!normalized) throw new BadRequestError('Logo invalida', { domain: 'fabricantes' });
  const logoUrl = await uploadFabricanteLogo({ supabase, accountId, fabricanteId: id, upload: normalized });
  if (!logoUrl) throw new DatabaseError('Falha ao enviar logo', { domain: 'fabricantes' });
  const { data: updated, error } = await supabase.from('fabricantes').update({ logo_url: logoUrl, updated_at: new Date().toISOString() }).eq('id', id).eq('account_id', accountId).select('*').single();
  if (error) {
    logSupabaseFailure('updateFabricanteLogo', error, { id, accountId, logo_url: logoUrl });
    throw new DatabaseError('Falha ao atualizar logo', { details: error });
  }
  return updated || { ...current, logo_url: logoUrl };
}

function normalizeFabricanteRecord(data = {}, current = null) {
  const base = current || {};
  const payload = {
    nome: data.nome !== undefined ? String(data.nome || '').trim() : base.nome,
    razao_social: data.razao_social !== undefined ? (data.razao_social || null) : base.razao_social || null,
    cnpj: data.cnpj !== undefined ? normalizeCnpj(data.cnpj) : base.cnpj || null,
    site: data.site !== undefined ? (data.site || null) : base.site || null,
    email_comercial: data.email_comercial !== undefined ? (data.email_comercial || null) : base.email_comercial || null,
    telefone: data.telefone !== undefined ? (data.telefone || null) : base.telefone || null,
    regiao_atendida: data.regiao_atendida !== undefined ? (data.regiao_atendida || null) : base.regiao_atendida || null,
    logradouro: data.logradouro !== undefined ? (data.logradouro || null) : base.logradouro || null,
    numero: data.numero !== undefined ? (data.numero || null) : base.numero || null,
    complemento: data.complemento !== undefined ? (data.complemento || null) : base.complemento || null,
    bairro: data.bairro !== undefined ? (data.bairro || null) : base.bairro || null,
    cidade: data.cidade !== undefined ? (data.cidade || null) : base.cidade || null,
    uf: data.uf !== undefined ? (data.uf || null) : base.uf || null,
    cep: data.cep !== undefined ? (data.cep || null) : base.cep || null,
    endereco_completo: data.endereco_completo !== undefined ? (data.endereco_completo || null) : base.endereco_completo || null,
    logo_url: data.logo_url !== undefined ? sanitizeLogoUrl(data.logo_url) : sanitizeLogoUrl(base.logo_url),
    status: data.status !== undefined ? (data.status === 'inativo' ? 'inativo' : 'ativo') : base.status || 'ativo',
    pedido_minimo_valor: data.pedido_minimo_valor !== undefined ? normalizeNonNegativeNumber(data.pedido_minimo_valor, 'pedido_minimo_valor') : normalizeNonNegativeNumber(base.pedido_minimo_valor ?? base.pedido_minimo ?? 0, 'pedido_minimo_valor'),
    pedido_minimo_itens: data.pedido_minimo_itens !== undefined ? Math.floor(normalizeNonNegativeNumber(data.pedido_minimo_itens, 'pedido_minimo_itens')) : Math.floor(normalizeNonNegativeNumber(base.pedido_minimo_itens ?? 0, 'pedido_minimo_itens')),
    prazo_entrega_dias: data.prazo_entrega_dias !== undefined ? Math.floor(normalizeNonNegativeNumber(data.prazo_entrega_dias, 'prazo_entrega_dias')) : Math.floor(normalizeNonNegativeNumber(base.prazo_entrega_dias ?? 0, 'prazo_entrega_dias')),
    comissao_padrao_percentual: data.comissao_padrao_percentual !== undefined ? normalizePercent(data.comissao_padrao_percentual) : normalizePercent(base.comissao_padrao_percentual ?? 0),
    politica_troca: data.politica_troca !== undefined ? (data.politica_troca || null) : base.politica_troca || null,
    aceita_bonificacao: data.aceita_bonificacao !== undefined ? normalizeBoolean(data.aceita_bonificacao, 'aceita_bonificacao') : (typeof base.aceita_bonificacao === 'boolean' ? base.aceita_bonificacao : false),
    aceita_consignacao: data.aceita_consignacao !== undefined ? normalizeBoolean(data.aceita_consignacao, 'aceita_consignacao') : (typeof base.aceita_consignacao === 'boolean' ? base.aceita_consignacao : false),
    condicoes_pagamento: data.condicoes_pagamento !== undefined ? (data.condicoes_pagamento || null) : base.condicoes_pagamento || null,
    observacoes_comerciais: data.observacoes_comerciais !== undefined ? (data.observacoes_comerciais || null) : base.observacoes_comerciais || null,
    tabela_precos_url: data.tabela_precos_url !== undefined ? (data.tabela_precos_url || null) : base.tabela_precos_url || null,
    observacoes: data.observacoes !== undefined ? (data.observacoes || null) : base.observacoes || null,
    pedido_minimo: data.pedido_minimo_valor !== undefined ? normalizeNonNegativeNumber(data.pedido_minimo_valor, 'pedido_minimo') : normalizeNonNegativeNumber(base.pedido_minimo_valor ?? base.pedido_minimo ?? 0, 'pedido_minimo'),
    boleto_minimo: data.pedido_minimo_itens !== undefined ? Math.floor(normalizeNonNegativeNumber(data.pedido_minimo_itens, 'boleto_minimo')) : Math.floor(normalizeNonNegativeNumber(base.pedido_minimo_itens ?? base.boleto_minimo ?? 0, 'boleto_minimo')),
    updated_at: new Date().toISOString()
  };
  if (!payload.endereco_completo) {
    payload.endereco_completo = composeEnderecoCompleto(payload);
  }
  return payload;
}

function sanitizeFabricantePayload(payload = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (key === 'logo_upload') continue;
    clean[key] = key === 'logo_url' ? sanitizeLogoUrl(value) : value;
  }
  return clean;
}

function mapResponsibleVendor(vendedor = null) {
  if (!vendedor) {
    return {
      responsavel_vendedor_id: null,
      responsavel_comercial_nome: null,
      responsavel_comercial_email: null
    };
  }

  return {
    responsavel_vendedor_id: vendedor.id || null,
    responsavel_comercial_nome: vendedor.nome || null,
    responsavel_comercial_email: vendedor.email || null
  };
}

async function resolveFabricanteResponsibleVendor(accountId, vendedorId) {
  const normalizedId = normalizeNullableUuid(vendedorId);
  if (!normalizedId) return null;
  const vendor = await getVendedorById(normalizedId, { accountId });
  if (!vendor) {
    throw new BadRequestError('Vendedor responsavel invalido para a conta', { domain: 'fabricantes', code: 'VENDEDOR_INVALIDO' });
  }
  if (String(vendor.status || '').toLowerCase() === 'inativo') {
    throw new BadRequestError('Vendedor responsavel inativo', { domain: 'fabricantes', code: 'VENDEDOR_INATIVO' });
  }
  return vendor;
}

async function attachResponsibleVendor(accountId, items = []) {
  const withResponse = [];
  const vendorIds = [...new Set((items || []).map((item) => item?.responsavel_vendedor_id).filter(Boolean))];
  let vendors = [];
  if (vendorIds.length) {
    for (const vendorId of vendorIds) {
      try {
        vendors.push(await getVendedorById(vendorId, { accountId }));
      } catch {
        // Ignore missing vendor references and keep the response graceful.
      }
    }
  }
  for (const item of items || []) {
    const vendor = vendors.find((row) => row.id === item.responsavel_vendedor_id) || null;
    withResponse.push({ ...item, ...mapResponsibleVendor(vendor) });
  }
  return withResponse;
}

function logSupabaseFailure(action, error, payload) {
  console.error(`[fabricantes.repository] ${action} failed`, {
    message: error?.message || null,
    details: error?.details || null,
    hint: error?.hint || null,
    code: error?.code || null,
    payload: sanitizeFabricantePayload(payload)
  });
}

function normalizeFabricantePatchData(data = {}) {
  const payload = { ...data };
  for (const field of ['account_id', 'tenant_id', 'owner_user_id']) delete payload[field];
  if (payload.logo_upload) delete payload.logo_upload;
  return payload;
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

function assertCommercialRules(data = {}) {
  for (const field of ['pedido_minimo_valor', 'pedido_minimo_itens', 'prazo_entrega_dias', 'comissao_padrao_percentual']) {
    if (data[field] !== undefined && data[field] !== null) {
      const num = Number(data[field]);
      if (!Number.isFinite(num) || num < 0) {
        throw new BadRequestError('Valores invalidos', { domain: 'fabricantes', code: 'NEGATIVE_VALUE' });
      }
    }
  }
  if (data.comissao_padrao_percentual !== undefined && Number(data.comissao_padrao_percentual) > 100) {
    throw new BadRequestError('Comissao padrao percentual invalida', { domain: 'fabricantes', code: 'PERCENT_OUT_OF_RANGE' });
  }
  for (const field of ['aceita_bonificacao', 'aceita_consignacao']) {
    if (data[field] !== undefined && typeof data[field] !== 'boolean') {
      throw new BadRequestError(`Tipo invalido para ${field}`, { domain: 'fabricantes', code: 'BOOLEAN_INVALID' });
    }
  }
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
    return { items: await attachResponsibleVendor(accountId, data || []), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  const items = memoryFabricantes.filter((item) => item.account_id === accountId);
  const q = String(filters.search || '').trim().toLowerCase();
  const filtered = items.filter((item) => (!filters.status || item.status === filters.status) && (!q || [item.nome, item.razao_social, item.cnpj].some((v) => String(v || '').toLowerCase().includes(q))));
  const total = filtered.length;
  const from = (page - 1) * limit;
  return { items: await attachResponsibleVendor(accountId, filtered.slice(from, from + limit)), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
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
    return (await attachResponsibleVendor(accountId, [data]))[0];
  }

  const item = memoryFabricantes.find((row) => row.id === id && row.account_id === accountId);
  if (!item) throw new NotFoundError('Fabricante nao encontrado', { domain: 'fabricantes', code: 'FABRICANTE_NOT_FOUND' });
  return item;
}

export async function createFabricante(data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const payloadInput = normalizeFabricantePatchData({ ...data });
  assertCommercialRules(payloadInput);
  const payload = {
    account_id: accountId,
    nome: String(data.nome || '').trim(),
    razao_social: data.razao_social || null,
    cnpj: normalizeCnpj(data.cnpj),
    site: data.site || null,
    email_comercial: data.email_comercial || null,
    telefone: data.telefone || null,
    regiao_atendida: data.regiao_atendida || null,
    logradouro: data.logradouro || null,
    numero: data.numero || null,
    complemento: data.complemento || null,
    bairro: data.bairro || null,
    cidade: data.cidade || null,
    uf: data.uf || null,
    cep: data.cep || null,
    endereco_completo: data.endereco_completo || composeEnderecoCompleto(data),
    logo_url: sanitizeLogoUrl(data.logo_url),
    status: data.status === 'inativo' ? 'inativo' : 'ativo',
    pedido_minimo_valor: normalizeNonNegativeNumber(data.pedido_minimo_valor ?? data.pedido_minimo ?? 0, 'pedido_minimo_valor'),
    pedido_minimo_itens: Math.floor(normalizeNonNegativeNumber(data.pedido_minimo_itens ?? 0, 'pedido_minimo_itens')),
    prazo_entrega_dias: Math.floor(normalizeNonNegativeNumber(data.prazo_entrega_dias ?? 0, 'prazo_entrega_dias')),
    comissao_padrao_percentual: normalizePercent(data.comissao_padrao_percentual ?? 0),
    politica_troca: data.politica_troca || null,
    aceita_bonificacao: typeof data.aceita_bonificacao === 'boolean' ? data.aceita_bonificacao : false,
    aceita_consignacao: typeof data.aceita_consignacao === 'boolean' ? data.aceita_consignacao : false,
    condicoes_pagamento: data.condicoes_pagamento || null,
    observacoes_comerciais: data.observacoes_comerciais || null,
    tabela_precos_url: data.tabela_precos_url || null,
    pedido_minimo: normalizeNonNegativeNumber(data.pedido_minimo_valor ?? data.pedido_minimo ?? 0, 'pedido_minimo'),
    boleto_minimo: Math.floor(normalizeNonNegativeNumber(data.pedido_minimo_itens ?? data.boleto_minimo ?? 0, 'boleto_minimo')),
    observacoes: data.observacoes || null
  };
  const responsavelVendedor = await resolveFabricanteResponsibleVendor(accountId, data.responsavel_vendedor_id);
  payload.responsavel_vendedor_id = responsavelVendedor?.id || null;
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
  if (findDuplicateFabricante(accountId, payload)) throw new ConflictError('Fabricante duplicado', { domain: 'fabricantes', code: 'FABRICANTE_DUPLICADO' });

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: inserted, error } = await supabase.from('fabricantes').insert(payload).select('*').single();
    if (error) {
      logSupabaseFailure('createFabricante', error, payload);
      throw new DatabaseError('Falha ao criar fabricante', { details: error });
    }
    const logoUrl = await uploadFabricanteLogo({ supabase, accountId, fabricanteId: inserted.id, upload: data.logo_upload });
    if (logoUrl) {
      const { data: logoUpdated, error: logoError } = await supabase.from('fabricantes').update({ logo_url: logoUrl, updated_at: new Date().toISOString() }).eq('id', inserted.id).eq('account_id', accountId).select('*').single();
      if (logoError) {
        logSupabaseFailure('createFabricanteLogoUrl', logoError, { id: inserted.id, accountId, logo_url: logoUrl });
        return inserted;
      }
      return logoUpdated;
    }
    return (await attachResponsibleVendor(accountId, [inserted]))[0];
  }

  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryFabricantes.push(item);
  return (await attachResponsibleVendor(accountId, [item]))[0];
}

export async function updateFabricante(id, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const payloadInput = normalizeFabricantePatchData({ ...data });
  assertCommercialRules(payloadInput);

  if (isSupabaseMode()) {
    const current = await getFabricanteById(id, { accountId });
    const normalizedData = normalizeFabricantePatchData(data);
    const payload = sanitizeFabricantePayload(normalizeFabricanteRecord(normalizedData, current));
    const next = { ...current, ...payload };
    const responsavelVendedor = await resolveFabricanteResponsibleVendor(accountId, data.responsavel_vendedor_id !== undefined ? data.responsavel_vendedor_id : current.responsavel_vendedor_id);
    if (data.responsavel_vendedor_id !== undefined) {
      payload.responsavel_vendedor_id = responsavelVendedor?.id || null;
    }
    if (!next.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
    if (findDuplicateFabricante(accountId, next, id)) throw new ConflictError('Fabricante duplicado', { domain: 'fabricantes', code: 'FABRICANTE_DUPLICADO' });
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('fabricantes').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) {
      logSupabaseFailure('updateFabricante', error, payload);
      throw new DatabaseError('Falha ao atualizar fabricante', { details: error });
    }
    const logoUrl = await uploadFabricanteLogo({ supabase, accountId, fabricanteId: id, upload: data.logo_upload });
    if (logoUrl) {
      const { data: logoUpdated, error: logoError } = await supabase.from('fabricantes').update({ logo_url: logoUrl, updated_at: new Date().toISOString() }).eq('id', id).eq('account_id', accountId).select('*').single();
      if (logoError) {
        logSupabaseFailure('updateFabricanteLogoUrl', logoError, { id, accountId, logo_url: logoUrl });
        return updated;
      }
      return logoUpdated;
    }
    return (await attachResponsibleVendor(accountId, [updated]))[0];
  }

  const idx = memoryFabricantes.findIndex((row) => row.id === id && row.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Fabricante nao encontrado', { domain: 'fabricantes', code: 'FABRICANTE_NOT_FOUND' });
  const current = memoryFabricantes[idx];
  const payload = normalizeFabricanteRecord(normalizeFabricantePatchData(data), current);
  if (data.responsavel_vendedor_id !== undefined) {
    const responsavelVendedor = await resolveFabricanteResponsibleVendor(accountId, data.responsavel_vendedor_id);
    payload.responsavel_vendedor_id = responsavelVendedor?.id || null;
  }
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
  if (findDuplicateFabricante(accountId, payload, id)) throw new ConflictError('Fabricante duplicado', { domain: 'fabricantes', code: 'FABRICANTE_DUPLICADO' });
  memoryFabricantes[idx] = payload;
  return (await attachResponsibleVendor(accountId, [payload]))[0];
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

export async function deleteCondicaoPagamento(fabricanteId, condicaoId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (isSupabaseMode()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { error } = await supabase
      .from('fabricante_condicoes_pagamento')
      .delete()
      .eq('id', condicaoId)
      .eq('account_id', accountId)
      .eq('fabricante_id', fabricanteId);
    if (error) throw new DatabaseError('Falha ao excluir condicao de pagamento', { details: error });
    return { ok: true };
  }

  const idx = memoryCondicoes.findIndex((row) => row.id === condicaoId && row.account_id === accountId && row.fabricante_id === fabricanteId);
  if (idx < 0) throw new NotFoundError('Condicao nao encontrada', { domain: 'fabricantes', code: 'CONDICAO_NOT_FOUND' });
  memoryCondicoes.splice(idx, 1);
  return { ok: true };
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
