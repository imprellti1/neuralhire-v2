import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { FabricantesQueries } from '../../database/queries/fabricantes.queries.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getVendedorById } from '../vendedores/vendedores.repository.js';

const memoryFabricantes = [];
const memoryCondicoes = [];
const memoryFabricanteVendedores = [];
let databaseModeCache = null;

class FabricantesRepository extends BaseRepository {
  constructor(adapter = database) {
    super(adapter, { logContext: 'fabricantes' });
  }
}

const repository = new FabricantesRepository();

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

function sanitizePaymentConditionInput(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function normalizePaymentConditionEntry(entry, index = 0) {
  const prazoRaw = String(entry?.prazo ?? entry?.descricao ?? entry?.condicao_pagamento ?? entry?.nome ?? '').trim().replace(/\s+/g, '');
  if (!prazoRaw) {
    throw new BadRequestError(`Condicao de pagamento invalida na linha ${index + 1}`, { domain: 'fabricantes', code: 'CONDICAO_INVALIDA' });
  }
  if (!/^\d+(?:\/\d+)*$/.test(prazoRaw)) {
    throw new BadRequestError(`Condicao de pagamento invalida na linha ${index + 1}`, { domain: 'fabricantes', code: 'CONDICAO_INVALIDA' });
  }
  const parts = prazoRaw.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => !/^[1-9]\d*$/.test(part))) {
    throw new BadRequestError(`Condicao de pagamento invalida na linha ${index + 1}`, { domain: 'fabricantes', code: 'CONDICAO_INVALIDA' });
  }
  const parcelas = parts.length;
  const prazoNumeros = parts.map((part) => Number(part));
  const prazoMedio = Math.round(prazoNumeros.reduce((sum, part) => sum + part, 0) / parcelas);
  return {
    id: String(entry?.id || randomUUID()),
    prazo: parts.join('/'),
    parcelas,
    prazo_medio_dias: prazoMedio
  };
}

function normalizePaymentConditions(value) {
  const input = sanitizePaymentConditionInput(value);
  return input.map((entry, index) => normalizePaymentConditionEntry(entry, index));
}

function normalizeVinculoPaymentConditions(value) {
  const input = sanitizePaymentConditionInput(value);
  return input.map((entry, index) => {
    const normalized = normalizePaymentConditionEntry(entry, index);
    return {
      prazo: normalized.prazo,
      parcelas: normalized.parcelas,
      prazo_medio_dias: normalized.prazo_medio_dias
    };
  });
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
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_LOGO_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp']
]);

function normalizeLogoUpload(upload) {
  if (!upload || typeof upload !== 'object') return null;
  const fileName = String(upload.fileName || upload.filename || '').trim();
  const mimeType = String(upload.mimeType || upload.contentType || '').trim().toLowerCase();
  const base64 = String(upload.base64 || upload.data || '').trim();
  const size = Number(upload.size || 0);
  if (!fileName || !base64 || !mimeType) return null;
  if (!ALLOWED_LOGO_MIME_TYPES.has(mimeType)) return null;
  if (!Number.isFinite(size) || size <= 0 || size > MAX_LOGO_BYTES) return null;
  return { fileName, mimeType, base64, size };
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
    const ext = ALLOWED_LOGO_EXTENSIONS.get(normalized.mimeType);
    if (!ext) return null;
    const safeBaseName = path.basename(normalized.fileName, path.extname(normalized.fileName)).replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'logo';
    const objectPath = `${accountId}/${fabricanteId}/${Date.now()}-${safeBaseName}.${ext}`;
    const bytes = Buffer.from(normalized.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (bytes.length > MAX_LOGO_BYTES) return null;
    const { error } = await supabase.storage.from(FABRICANTES_LOGO_BUCKET).upload(objectPath, bytes, {
      upsert: true,
      contentType: normalized.mimeType
    });
    if (error) {
      logSupabaseFailure('uploadFabricanteLogo', error, { account_id: accountId, fabricante_id: fabricanteId, path: objectPath, mimeType: normalized.mimeType });
      return null;
    }
    const { data } = supabase.storage.from(FABRICANTES_LOGO_BUCKET).getPublicUrl(objectPath);
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
  const current = await getFabricanteById(id, { accountId });
  const normalized = normalizeLogoUpload(upload);
  if (!normalized) throw new BadRequestError('Logo invalida', { domain: 'fabricantes' });
  if (!ALLOWED_LOGO_MIME_TYPES.has(normalized.mimeType)) throw new BadRequestError('Formato de logo invalido', { domain: 'fabricantes', code: 'INVALID_FILE_TYPE' });
  if (normalized.size > MAX_LOGO_BYTES) throw new BadRequestError('Arquivo excede o limite permitido', { domain: 'fabricantes', code: 'PAYLOAD_TOO_LARGE' });
  const supabase = getSupabaseClient();
  const logoUrl = await uploadFabricanteLogo({ supabase, accountId, fabricanteId: id, upload: normalized });
  if (!logoUrl) throw new DatabaseError('Falha ao enviar logo', { domain: 'fabricantes' });
  if (await isDatabaseMode()) {
    const updated = await repository.one(FabricantesQueries.update(), [
      accountId, id, current.nome, current.razao_social, current.cnpj, current.site, current.email_comercial, current.telefone, current.regiao_atendida,
      current.logradouro, current.numero, current.complemento, current.bairro, current.cidade, current.uf, current.cep, current.endereco_completo, logoUrl, current.status,
      current.valor_minimo_duplicata, current.pedido_minimo_valor, current.pedido_minimo_itens, current.prazo_entrega_dias, current.comissao_padrao_percentual,
      current.politica_troca, current.aceita_bonificacao, current.aceita_consignacao, current.condicoes_pagamento, current.observacoes_comerciais,
      current.tabela_precos_url, current.pedido_minimo, current.boleto_minimo, current.observacoes, current.responsavel_vendedor_id, new Date().toISOString()
    ]);
    return updated || { ...current, logo_url: logoUrl };
  }
  return { ...current, logo_url: logoUrl };
}

function normalizeFabricanteRecord(data = {}, current = null) {
  const base = current || {};
  const valorMinimoDuplicata = data.valor_minimo_duplicata !== undefined ? data.valor_minimo_duplicata : data.pedido_minimo;
  const pedidoMinimoValor = data.pedido_minimo_valor !== undefined ? data.pedido_minimo_valor : data.pedido_minimo;
  const baseValorMinimoDuplicata = base.valor_minimo_duplicata ?? base.pedido_minimo ?? base.pedido_minimo_valor ?? 0;
  const basePedidoMinimoValor = base.pedido_minimo_valor ?? base.pedido_minimo ?? base.valor_minimo_duplicata ?? 0;
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
    valor_minimo_duplicata: valorMinimoDuplicata !== undefined ? normalizeNonNegativeNumber(valorMinimoDuplicata, 'valor_minimo_duplicata') : normalizeNonNegativeNumber(baseValorMinimoDuplicata, 'valor_minimo_duplicata'),
    pedido_minimo_valor: pedidoMinimoValor !== undefined ? normalizeNonNegativeNumber(pedidoMinimoValor, 'pedido_minimo_valor') : normalizeNonNegativeNumber(basePedidoMinimoValor, 'pedido_minimo_valor'),
    pedido_minimo_itens: data.pedido_minimo_itens !== undefined ? Math.floor(normalizeNonNegativeNumber(data.pedido_minimo_itens, 'pedido_minimo_itens')) : Math.floor(normalizeNonNegativeNumber(base.pedido_minimo_itens ?? 0, 'pedido_minimo_itens')),
    prazo_entrega_dias: data.prazo_entrega_dias !== undefined ? Math.floor(normalizeNonNegativeNumber(data.prazo_entrega_dias, 'prazo_entrega_dias')) : Math.floor(normalizeNonNegativeNumber(base.prazo_entrega_dias ?? 0, 'prazo_entrega_dias')),
    comissao_padrao_percentual: data.comissao_padrao_percentual !== undefined ? normalizePercent(data.comissao_padrao_percentual) : normalizePercent(base.comissao_padrao_percentual ?? 0),
    politica_troca: data.politica_troca !== undefined ? (data.politica_troca || null) : base.politica_troca || null,
    aceita_bonificacao: data.aceita_bonificacao !== undefined ? normalizeBoolean(data.aceita_bonificacao, 'aceita_bonificacao') : (typeof base.aceita_bonificacao === 'boolean' ? base.aceita_bonificacao : false),
    aceita_consignacao: data.aceita_consignacao !== undefined ? normalizeBoolean(data.aceita_consignacao, 'aceita_consignacao') : (typeof base.aceita_consignacao === 'boolean' ? base.aceita_consignacao : false),
    condicoes_pagamento: data.condicoes_pagamento !== undefined ? normalizePaymentConditions(data.condicoes_pagamento) : normalizePaymentConditions(base.condicoes_pagamento || []),
    observacoes_comerciais: data.observacoes_comerciais !== undefined ? (data.observacoes_comerciais || null) : base.observacoes_comerciais || null,
    tabela_precos_url: data.tabela_precos_url !== undefined ? (data.tabela_precos_url || null) : base.tabela_precos_url || null,
    observacoes: data.observacoes !== undefined ? (data.observacoes || null) : base.observacoes || null,
    pedido_minimo: valorMinimoDuplicata !== undefined ? normalizeNonNegativeNumber(valorMinimoDuplicata, 'pedido_minimo') : normalizeNonNegativeNumber(baseValorMinimoDuplicata, 'pedido_minimo'),
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
  if (payload.vendedores) delete payload.vendedores;
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

async function isDatabaseMode() {
  if (databaseModeCache !== null) return databaseModeCache;
  try {
    await repository.one(FabricantesQueries.ping(), []);
    databaseModeCache = true;
  } catch (error) {
    databaseModeCache = false;
    if (error?.code !== 'ECONNREFUSED' && error?.cause?.code !== 'ECONNREFUSED') {
      debugRepository('databaseModeProbeFailed', { message: error?.message || null, code: error?.code || null });
    }
  }
  return databaseModeCache;
}

function normalizeWhereValue(value) {
  return String(value || '').replace(/'/g, "''");
}

function buildWhereSql(filters = {}) {
  const clauses = [];
  if (filters.status) clauses.push(`status = '${normalizeWhereValue(filters.status)}'`);
  if (filters.search) {
    const search = normalizeWhereValue(String(filters.search).trim());
    if (search) clauses.push(`(nome ILIKE '%${search}%' OR razao_social ILIKE '%${search}%' OR cnpj ILIKE '%${search}%')`);
  }
  return clauses.join(' AND ');
}

async function getFabricanteRowById(id, accountId) {
  try {
    return await repository.one(FabricantesQueries.getById(), [accountId, id]);
  } catch (error) {
    if (error?.code === 'DATABASE_NOT_ONE') return null;
    throw error;
  }
}

async function loadFabricantesRows(accountId, filters = {}, options = {}) {
  const { page, limit } = normalizePagination(filters);
  const whereSql = buildWhereSql(filters);
  const from = (page - 1) * limit;
  const totalRow = await repository.one(FabricantesQueries.count(whereSql ? `account_id = $1 AND ${whereSql}` : 'account_id = $1'), [accountId]).catch((error) => {
    if (error?.code === 'DATABASE_NOT_ONE') return { total: 0 };
    throw error;
  });
  const items = await repository.many(FabricantesQueries.list(whereSql), [accountId, limit, from]);
  return { items: await attachResponsibleVendor(accountId, items || []), total: Number(totalRow?.total || 0), page, limit, totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit)) };
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
  for (const field of ['valor_minimo_duplicata', 'pedido_minimo_valor', 'pedido_minimo_itens', 'prazo_entrega_dias', 'comissao_padrao_percentual']) {
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

function normalizeVinculoStatus(value) {
  return String(value || '').toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
}

function normalizeVinculoNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new BadRequestError(`Valor invalido para ${field}`, { domain: 'fabricantes', code: 'NEGATIVE_VALUE' });
  if (num < 0) throw new BadRequestError(`Valor invalido para ${field}`, { domain: 'fabricantes', code: 'NEGATIVE_VALUE' });
  return num;
}

function normalizeFabricanteVinculoInput(data = {}) {
  return {
    vendedor_id: String(data.vendedor_id || '').trim(),
    principal: data.principal === undefined ? undefined : Boolean(data.principal),
    status: normalizeVinculoStatus(data.status),
    comissao_percentual: normalizeVinculoNumber(data.comissao_percentual, 'comissao_percentual'),
    pedido_minimo_valor: normalizeVinculoNumber(data.pedido_minimo_valor, 'pedido_minimo_valor'),
    valor_minimo_duplicata: normalizeVinculoNumber(data.valor_minimo_duplicata, 'valor_minimo_duplicata'),
    condicoes_pagamento: data.condicoes_pagamento === undefined ? undefined : normalizeVinculoPaymentConditions(data.condicoes_pagamento),
    observacoes: data.observacoes !== undefined ? (data.observacoes || null) : undefined
  };
}

function normalizeFabricanteVinculoRecord(data = {}, current = null) {
  const base = current || {};
  const payload = {
    vendedor_id: data.vendedor_id !== undefined ? String(data.vendedor_id || '').trim() : base.vendedor_id || null,
    principal: data.principal !== undefined ? Boolean(data.principal) : Boolean(base.principal),
    status: data.status !== undefined ? normalizeVinculoStatus(data.status) : normalizeVinculoStatus(base.status),
    comissao_percentual: data.comissao_percentual !== undefined ? normalizeVinculoNumber(data.comissao_percentual, 'comissao_percentual') : normalizeVinculoNumber(base.comissao_percentual, 'comissao_percentual'),
    pedido_minimo_valor: data.pedido_minimo_valor !== undefined ? normalizeVinculoNumber(data.pedido_minimo_valor, 'pedido_minimo_valor') : normalizeVinculoNumber(base.pedido_minimo_valor, 'pedido_minimo_valor'),
    valor_minimo_duplicata: data.valor_minimo_duplicata !== undefined ? normalizeVinculoNumber(data.valor_minimo_duplicata, 'valor_minimo_duplicata') : normalizeVinculoNumber(base.valor_minimo_duplicata, 'valor_minimo_duplicata'),
    condicoes_pagamento: data.condicoes_pagamento !== undefined ? normalizeVinculoPaymentConditions(data.condicoes_pagamento) : normalizeVinculoPaymentConditions(base.condicoes_pagamento || []),
    observacoes: data.observacoes !== undefined ? (data.observacoes || null) : base.observacoes || null,
    updated_at: new Date().toISOString()
  };
  return payload;
}

async function resolveVendedorForFabricante(accountId, vendedorId) {
  const vendedor = await getVendedorById(vendedorId, { accountId });
  if (!vendedor) throw new BadRequestError('Vendedor invalido para a conta', { domain: 'fabricantes', code: 'VENDEDOR_INVALIDO' });
  if (String(vendedor.status || '').toLowerCase() !== 'ativo') {
    throw new BadRequestError('Vendedor deve estar ativo', { domain: 'fabricantes', code: 'VENDEDOR_INATIVO' });
  }
  return vendedor;
}

function validatePrincipalUnique(items = []) {
  const principals = items.filter((item) => item.principal);
  if (principals.length > 1) {
    throw new BadRequestError('Apenas um vendedor principal por fabrica', { domain: 'fabricantes', code: 'MULTIPLE_PRINCIPAL' });
  }
}

async function hydrateFabricanteVinculos(accountId, items = []) {
  const vendedorIds = [...new Set((items || []).map((item) => item.vendedor_id).filter(Boolean))];
  const vendedores = [];
  for (const vendedorId of vendedorIds) {
    try {
      vendedores.push(await getVendedorById(vendedorId, { accountId }));
    } catch {
      // Keep response resilient if a referenced vendor disappeared.
    }
  }
  return (items || []).map((item) => {
    const vendedor = vendedores.find((row) => row.id === item.vendedor_id) || null;
    return {
      ...item,
      vendedor: vendedor ? { id: vendedor.id, nome: vendedor.nome, email: vendedor.email, status: vendedor.status } : null,
      vendedor_nome: vendedor?.nome || null,
      vendedor_email: vendedor?.email || null
    };
  });
}

async function assertVinculoConstraints(accountId, fabricanteId, items = []) {
  const fabricante = await getFabricanteById(fabricanteId, { accountId });
  if (!fabricante) throw new NotFoundError('Fabricante nao encontrado', { domain: 'fabricantes', code: 'FABRICANTE_NOT_FOUND' });
  validatePrincipalUnique(items);
  for (const item of items) {
    if (!item.vendedor_id) throw new BadRequestError('Vendedor obrigatorio no vinculo', { domain: 'fabricantes', code: 'VENDEDOR_INVALIDO' });
    await resolveVendedorForFabricante(accountId, item.vendedor_id);
  }
}

export async function listFabricantes(filters = {}, options = {}) {
  const { page, limit } = normalizePagination(filters);
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  debugRepository('listFabricantes', { accountId, filters });

  if (await isDatabaseMode()) {
    return loadFabricantesRows(accountId, filters, options);
  }

  const items = memoryFabricantes.filter((item) => String(item.account_id || item.accountId || '') === String(accountId));
  const q = String(filters.search || '').trim().toLowerCase();
  const filtered = items.filter((item) => (!filters.status || item.status === filters.status) && (!q || [item.nome, item.razao_social, item.cnpj].some((v) => String(v || '').toLowerCase().includes(q))));
  const total = filtered.length;
  const from = (page - 1) * limit;
  return { items: await attachResponsibleVendor(accountId, filtered.slice(from, from + limit)), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getFabricanteById(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (await isDatabaseMode()) {
    const data = await getFabricanteRowById(id, accountId);
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
    valor_minimo_duplicata: normalizeNonNegativeNumber(data.valor_minimo_duplicata ?? data.pedido_minimo ?? 0, 'valor_minimo_duplicata'),
    pedido_minimo_valor: normalizeNonNegativeNumber(data.pedido_minimo_valor ?? data.pedido_minimo ?? 0, 'pedido_minimo_valor'),
    pedido_minimo_itens: Math.floor(normalizeNonNegativeNumber(data.pedido_minimo_itens ?? 0, 'pedido_minimo_itens')),
    prazo_entrega_dias: Math.floor(normalizeNonNegativeNumber(data.prazo_entrega_dias ?? 0, 'prazo_entrega_dias')),
    comissao_padrao_percentual: normalizePercent(data.comissao_padrao_percentual ?? 0),
    politica_troca: data.politica_troca || null,
    aceita_bonificacao: typeof data.aceita_bonificacao === 'boolean' ? data.aceita_bonificacao : false,
    aceita_consignacao: typeof data.aceita_consignacao === 'boolean' ? data.aceita_consignacao : false,
    condicoes_pagamento: normalizePaymentConditions(data.condicoes_pagamento || []),
    observacoes_comerciais: data.observacoes_comerciais || null,
    tabela_precos_url: data.tabela_precos_url || null,
    pedido_minimo: normalizeNonNegativeNumber(data.valor_minimo_duplicata ?? data.pedido_minimo ?? 0, 'pedido_minimo'),
    boleto_minimo: Math.floor(normalizeNonNegativeNumber(data.pedido_minimo_itens ?? data.boleto_minimo ?? 0, 'boleto_minimo')),
    observacoes: data.observacoes || null
  };
  const responsavelVendedor = await resolveFabricanteResponsibleVendor(accountId, data.responsavel_vendedor_id);
  payload.responsavel_vendedor_id = responsavelVendedor?.id || null;
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'fabricantes' });
  if (findDuplicateFabricante(accountId, payload)) throw new ConflictError('Fabricante duplicado', { domain: 'fabricantes', code: 'FABRICANTE_DUPLICADO' });

  if (await isDatabaseMode()) {
    const timestamp = new Date().toISOString();
    const inserted = await repository.one(FabricantesQueries.insert(), [
      randomUUID(), accountId, payload.nome, payload.razao_social, payload.cnpj, payload.site, payload.email_comercial, payload.telefone, payload.regiao_atendida,
      payload.logradouro, payload.numero, payload.complemento, payload.bairro, payload.cidade, payload.uf, payload.cep, payload.endereco_completo, payload.logo_url, payload.status,
      payload.valor_minimo_duplicata, payload.pedido_minimo_valor, payload.pedido_minimo_itens, payload.prazo_entrega_dias, payload.comissao_padrao_percentual,
      payload.politica_troca, payload.aceita_bonificacao, payload.aceita_consignacao, payload.condicoes_pagamento, payload.observacoes_comerciais,
      payload.tabela_precos_url, payload.pedido_minimo, payload.boleto_minimo, payload.observacoes, payload.responsavel_vendedor_id, timestamp, timestamp
    ]);
    const supabase = getSupabaseClient();
    const logoUrl = await uploadFabricanteLogo({ supabase, accountId, fabricanteId: inserted.id, upload: data.logo_upload });
    if (logoUrl) {
      const updated = await repository.one(FabricantesQueries.update(), [
        accountId, inserted.id, inserted.nome, inserted.razao_social, inserted.cnpj, inserted.site, inserted.email_comercial, inserted.telefone, inserted.regiao_atendida,
        inserted.logradouro, inserted.numero, inserted.complemento, inserted.bairro, inserted.cidade, inserted.uf, inserted.cep, inserted.endereco_completo, logoUrl, inserted.status,
        inserted.valor_minimo_duplicata, inserted.pedido_minimo_valor, inserted.pedido_minimo_itens, inserted.prazo_entrega_dias, inserted.comissao_padrao_percentual,
        inserted.politica_troca, inserted.aceita_bonificacao, inserted.aceita_consignacao, inserted.condicoes_pagamento, inserted.observacoes_comerciais,
        inserted.tabela_precos_url, inserted.pedido_minimo, inserted.boleto_minimo, inserted.observacoes, inserted.responsavel_vendedor_id, new Date().toISOString()
      ]);
      return (await attachResponsibleVendor(accountId, [updated]))[0];
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

  if (await isDatabaseMode()) {
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
    const updated = await repository.one(FabricantesQueries.update(), [
      accountId, id, payload.nome, payload.razao_social, payload.cnpj, payload.site, payload.email_comercial, payload.telefone, payload.regiao_atendida,
      payload.logradouro, payload.numero, payload.complemento, payload.bairro, payload.cidade, payload.uf, payload.cep, payload.endereco_completo, payload.logo_url, payload.status,
      payload.valor_minimo_duplicata, payload.pedido_minimo_valor, payload.pedido_minimo_itens, payload.prazo_entrega_dias, payload.comissao_padrao_percentual,
      payload.politica_troca, payload.aceita_bonificacao, payload.aceita_consignacao, payload.condicoes_pagamento, payload.observacoes_comerciais,
      payload.tabela_precos_url, payload.pedido_minimo, payload.boleto_minimo, payload.observacoes, payload.responsavel_vendedor_id, new Date().toISOString()
    ]);
    const supabase = getSupabaseClient();
    const logoUrl = await uploadFabricanteLogo({ supabase, accountId, fabricanteId: id, upload: data.logo_upload });
    if (logoUrl) {
      const logoUpdated = await repository.one(FabricantesQueries.update(), [
        accountId, id, updated.nome, updated.razao_social, updated.cnpj, updated.site, updated.email_comercial, updated.telefone, updated.regiao_atendida,
        updated.logradouro, updated.numero, updated.complemento, updated.bairro, updated.cidade, updated.uf, updated.cep, updated.endereco_completo, logoUrl, updated.status,
        updated.valor_minimo_duplicata, updated.pedido_minimo_valor, updated.pedido_minimo_itens, updated.prazo_entrega_dias, updated.comissao_padrao_percentual,
        updated.politica_troca, updated.aceita_bonificacao, updated.aceita_consignacao, updated.condicoes_pagamento, updated.observacoes_comerciais,
        updated.tabela_precos_url, updated.pedido_minimo, updated.boleto_minimo, updated.observacoes, updated.responsavel_vendedor_id, new Date().toISOString()
      ]);
      return (await attachResponsibleVendor(accountId, [logoUpdated]))[0];
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
  memoryFabricantes[idx] = { ...current, ...payload, account_id: accountId, id };
  return (await attachResponsibleVendor(accountId, [memoryFabricantes[idx]]))[0];
}

export async function listCondicoesPagamento(fabricanteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const fabricante = await getFabricanteById(fabricanteId, { accountId });
  return { items: normalizePaymentConditions(fabricante.condicoes_pagamento || []), total: (fabricante.condicoes_pagamento || []).length };
}

export async function createCondicaoPagamento(fabricanteId, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = await getFabricanteById(fabricanteId, { accountId });
  const normalized = normalizePaymentConditions([data])[0];
  const payload = [...(current.condicoes_pagamento || []), normalized];
  return updateFabricante(fabricanteId, { condicoes_pagamento: payload }, { accountId });
}

export async function updateCondicaoPagamento(fabricanteId, condicaoId, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = await getFabricanteById(fabricanteId, { accountId });
  const items = normalizePaymentConditions(current.condicoes_pagamento || []);
  const idx = items.findIndex((row, rowIndex) => String(row.id || rowIndex) === String(condicaoId));
  if (idx < 0) throw new NotFoundError('Condicao nao encontrada', { domain: 'fabricantes', code: 'CONDICAO_NOT_FOUND' });
  const next = normalizePaymentConditionEntry({ ...(items[idx] || {}), ...data }, idx);
  const updated = [...items];
  updated[idx] = { ...updated[idx], ...next };
  return updateFabricante(fabricanteId, { condicoes_pagamento: updated }, { accountId });
}

export async function deleteCondicaoPagamento(fabricanteId, condicaoId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = await getFabricanteById(fabricanteId, { accountId });
  const items = normalizePaymentConditions(current.condicoes_pagamento || []);
  const updated = items.filter((row, index) => String(row.id || index) !== String(condicaoId));
  return updateFabricante(fabricanteId, { condicoes_pagamento: updated }, { accountId });
}

export async function listFabricanteVendedores(fabricanteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getFabricanteById(fabricanteId, { accountId });
  if (await isDatabaseMode()) {
    const data = await repository.many(FabricantesQueries.listVendedores(), [accountId, fabricanteId]);
    return { items: await hydrateFabricanteVinculos(accountId, data || []), total: (data || []).length };
  }
  const items = memoryFabricanteVendedores.filter((row) => row.account_id === accountId && row.fabricante_id === fabricanteId);
  return { items: await hydrateFabricanteVinculos(accountId, items), total: items.length };
}

export async function replaceFabricanteVendedores(fabricanteId, vinculos = [], options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const items = Array.isArray(vinculos) ? vinculos : [];
  await assertVinculoConstraints(accountId, fabricanteId, items);
  if (await isDatabaseMode()) {
    await repository.execute(FabricantesQueries.deleteVendedores(), [accountId, fabricanteId]);
    if (items.length) {
      for (const item of items) {
        await repository.one(FabricantesQueries.insertVendedor(), [
          randomUUID(), accountId, fabricanteId, item.vendedor_id, Boolean(item.principal), normalizeVinculoStatus(item.status), item.comissao_percentual,
          item.pedido_minimo_valor, item.valor_minimo_duplicata, item.condicoes_pagamento || [], item.observacoes || null, new Date().toISOString(), new Date().toISOString()
        ]);
      }
    }
    return listFabricanteVendedores(fabricanteId, options);
  }
  const remaining = memoryFabricanteVendedores.filter((row) => !(row.account_id === accountId && row.fabricante_id === fabricanteId));
  memoryFabricanteVendedores.length = 0;
  memoryFabricanteVendedores.push(...remaining);
  for (const item of items) {
    memoryFabricanteVendedores.push({
      id: randomUUID(),
      account_id: accountId,
      fabricante_id: fabricanteId,
      vendedor_id: item.vendedor_id,
      principal: Boolean(item.principal),
      status: normalizeVinculoStatus(item.status),
      comissao_percentual: item.comissao_percentual ?? null,
      pedido_minimo_valor: item.pedido_minimo_valor ?? null,
      valor_minimo_duplicata: item.valor_minimo_duplicata ?? null,
      condicoes_pagamento: item.condicoes_pagamento || [],
      observacoes: item.observacoes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return listFabricanteVendedores(fabricanteId, options);
}

export async function updateFabricanteVendedor(fabricanteId, vendedorId, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getFabricanteById(fabricanteId, { accountId });
  await resolveVendedorForFabricante(accountId, vendedorId);
  const normalized = normalizeFabricanteVinculoInput(data);
  if (normalized.comissao_percentual !== null && normalized.comissao_percentual > 100) {
    throw new BadRequestError('Comissao invalida', { domain: 'fabricantes', code: 'PERCENT_OUT_OF_RANGE' });
  }
  const currentList = (await listFabricanteVendedores(fabricanteId, options)).items || [];
  const current = currentList.find((item) => String(item.vendedor_id) === String(vendedorId));
  if (!current) throw new NotFoundError('Vinculo nao encontrado', { domain: 'fabricantes', code: 'VINCULO_NOT_FOUND' });
  const next = normalizeFabricanteVinculoRecord(normalized, current);
  if (next.principal) validatePrincipalUnique(currentList.filter((item) => String(item.vendedor_id) !== String(vendedorId)).concat([{ ...next, vendedor_id: vendedorId, principal: true }]));
  if (await isDatabaseMode()) {
    const updated = await repository.one(FabricantesQueries.updateVendedor(), [
      accountId, fabricanteId, vendedorId, next.vendedor_id, next.principal, next.status, next.comissao_percentual, next.pedido_minimo_valor, next.valor_minimo_duplicata, next.condicoes_pagamento, next.observacoes, next.updated_at
    ]);
    return (await hydrateFabricanteVinculos(accountId, [updated]))[0];
  }
  const idx = memoryFabricanteVendedores.findIndex((row) => row.account_id === accountId && row.fabricante_id === fabricanteId && String(row.vendedor_id) === String(vendedorId));
  if (idx < 0) throw new NotFoundError('Vinculo nao encontrado', { domain: 'fabricantes', code: 'VINCULO_NOT_FOUND' });
  memoryFabricanteVendedores[idx] = { ...memoryFabricanteVendedores[idx], ...next, fabricante_id: fabricanteId, vendedor_id: vendedorId };
  return (await hydrateFabricanteVinculos(accountId, [memoryFabricanteVendedores[idx]]))[0];
}

export async function deleteFabricanteVendedor(fabricanteId, vendedorId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getFabricanteById(fabricanteId, { accountId });
  await resolveVendedorForFabricante(accountId, vendedorId);
  if (await isDatabaseMode()) {
    await repository.execute(FabricantesQueries.deleteVendedor(), [accountId, fabricanteId, vendedorId]);
    return { removed: true };
  }
  const idx = memoryFabricanteVendedores.findIndex((row) => row.account_id === accountId && row.fabricante_id === fabricanteId && String(row.vendedor_id) === String(vendedorId));
  if (idx < 0) throw new NotFoundError('Vinculo nao encontrado', { domain: 'fabricantes', code: 'VINCULO_NOT_FOUND' });
  memoryFabricanteVendedores.splice(idx, 1);
  return { removed: true };
}

export function __resetMemoryFabricantesForTests() {
  memoryFabricantes.length = 0;
  memoryCondicoes.length = 0;
  memoryFabricanteVendedores.length = 0;
}

export function __loadMemoryFabricantes(items = []) {
  memoryFabricantes.length = 0;
  memoryCondicoes.length = 0;
  memoryFabricanteVendedores.length = 0;
  for (const item of items) {
    const account_id = item.account_id || item.accountId || null;
    memoryFabricantes.push({ ...item, account_id, accountId: item.accountId || account_id });
  }
}
