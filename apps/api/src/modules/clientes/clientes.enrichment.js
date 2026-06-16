import { AppError, DatabaseError, ValidationError } from '../../core/errors.js';

const BRASIL_API_BASE_URL = 'https://brasilapi.com.br/api/cnpj/v1';
const CNPJWS_BASE_URL = 'https://publica.cnpj.ws/cnpj';

export function normalizeCnpj(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCnpj(value) {
  return normalizeCnpj(value).length === 14;
}

export function normalizeBrasilApiPayload(payload = {}) {
  const parsedDate = payload?.data_inicio_atividade ? new Date(payload.data_inicio_atividade) : null;
  return {
    razao_social: payload?.razao_social || null,
    nome_fantasia: payload?.nome_fantasia || null,
    cnae_principal: payload?.cnae_fiscal_descricao || payload?.cnae_fiscal || null,
    situacao_cadastral: payload?.descricao_situacao_cadastral || null,
    data_abertura: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null,
    cep: payload?.cep || null,
    logradouro: payload?.logradouro || null,
    numero: payload?.numero || null,
    complemento: payload?.complemento || null,
    bairro: payload?.bairro || null,
    cidade: payload?.municipio || null,
    estado: payload?.uf || null,
    email_enriquecido: payload?.email || null,
    telefone_enriquecido: payload?.ddd_telefone_1 || payload?.ddd_telefone_2 || null
  };
}

function summarizeText(value, max = 200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function extractMeaningfulValue(value, depth = 0) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((entry) => extractMeaningfulValue(entry, depth + 1)).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    if (depth > 2) return '';
    const preferredKeys = ['message', 'error', 'detail', 'details', 'type', 'title', 'description', 'reason'];
    for (const key of preferredKeys) {
      if (value[key] !== undefined) {
        const extracted = extractMeaningfulValue(value[key], depth + 1);
        if (extracted) return extracted;
      }
    }
    const entries = Object.entries(value)
      .map(([key, entry]) => {
        const extracted = extractMeaningfulValue(entry, depth + 1);
        return extracted ? `${key}: ${extracted}` : '';
      })
      .filter(Boolean);
    if (entries.length) return entries.join('; ');
    const raw = safeJsonStringify(value);
    return raw || String(value);
  }
  return String(value);
}

async function readResponseBody(response) {
  const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
  let raw = '';
  try {
    raw = await response.text();
  } catch {
    raw = '';
  }
  const trimmed = summarizeText(raw);
  if (!trimmed) return { raw: '', summary: '' };
  if (contentType.includes('application/json')) {
    try {
      return { raw, summary: summarizeText(extractMeaningfulValue(JSON.parse(raw)) || trimmed) };
    } catch {
      return { raw, summary: trimmed };
    }
  }
  return { raw, summary: trimmed };
}

function buildErrorMessage(source, status, bodySummary) {
  const prefix = `${source} retornou status ${status}`;
  return bodySummary ? `${prefix}: ${bodySummary}` : prefix;
}

function createSourceUnavailableError(source, detail, status = 502) {
  return new AppError(`Falha ao consultar ${source}`, {
    statusCode: status,
    code: `${source.toUpperCase()}_UNAVAILABLE`,
    domain: 'clientes-crm',
    details: { message: detail },
    expose: true
  });
}

export async function fetchBrasilApiCnpj(cnpj, options = {}) {
  if (!isValidCnpj(cnpj)) {
    throw new ValidationError('CNPJ invalido', { domain: 'clientes-crm', code: 'CNPJ_INVALIDO' });
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new DatabaseError('Fetch indisponivel para consulta na BrasilAPI', { domain: 'clientes-crm' });
  }

  const url = `${BRASIL_API_BASE_URL}/${normalizeCnpj(cnpj)}`;
  let response;
  try {
    response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'NeuralHire/1.0', 'User-Agent': 'NeuralHire/1.0' } });
  } catch (error) {
    throw createSourceUnavailableError('BrasilAPI', error?.message || String(error));
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    const summary = summarizeText(body.summary || body.raw || 'sem detalhes');
    console.warn('[clientes.enrichment] brasilapi_error', { status: response.status, url, body: summary });
    throw new AppError(buildErrorMessage('BrasilAPI', response.status, summary), {
      statusCode: [403, 429].includes(response.status) || response.status >= 500 ? 502 : 422,
      code: 'BRASILAPI_ERROR',
      domain: 'clientes-crm',
      details: { status: response.status, body: summary, url },
      expose: true
    });
  }

  try {
    return body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return {};
  }
}

export function buildEnrichmentUpdateFromBrasilApi(payload) {
  return {
    ...normalizeBrasilApiPayload(payload),
    enriquecimento_status: 'concluido',
    enriquecimento_fonte: 'brasilapi',
    enriquecimento_ultima_execucao: new Date().toISOString(),
    enriquecimento_erro: null,
    enriquecimento_payload: payload || {}
  };
}

export function normalizeCnpjWsPayload(payload = {}) {
  const estabelecimento = payload?.estabelecimento || {};
  const cidade = estabelecimento?.cidade || {};
  const estado = estabelecimento?.estado || {};
  const ddd1 = String(estabelecimento?.ddd1 || '').trim();
  const telefone1 = String(estabelecimento?.telefone1 || '').trim();
  return {
    razao_social: payload?.razao_social || null,
    nome_fantasia: estabelecimento?.nome_fantasia || null,
    cnae_principal: estabelecimento?.atividade_principal?.descricao || null,
    situacao_cadastral: estabelecimento?.situacao_cadastral || null,
    data_abertura: estabelecimento?.data_inicio_atividade || null,
    cep: estabelecimento?.cep || null,
    logradouro: estabelecimento?.logradouro || null,
    numero: estabelecimento?.numero || null,
    complemento: estabelecimento?.complemento || null,
    bairro: estabelecimento?.bairro || null,
    cidade: cidade?.nome || null,
    estado: estado?.sigla || null,
    email_enriquecido: estabelecimento?.email || null,
    telefone_enriquecido: ddd1 || telefone1 ? `${ddd1}${telefone1}`.trim() : null
  };
}

export async function fetchCnpjWsCnpj(cnpj, options = {}) {
  if (!isValidCnpj(cnpj)) {
    throw new ValidationError('CNPJ invalido', { domain: 'clientes-crm', code: 'CNPJ_INVALIDO' });
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw createSourceUnavailableError('cnpj.ws', 'Fetch indisponivel');
  }

  const url = `${CNPJWS_BASE_URL}/${normalizeCnpj(cnpj)}`;
  let response;
  try {
    response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'NeuralHire/1.0', 'User-Agent': 'NeuralHire/1.0' } });
  } catch (error) {
    throw createSourceUnavailableError('cnpj.ws', error?.message || String(error));
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    const summary = summarizeText(body.summary || body.raw || 'sem detalhes');
    console.warn('[clientes.enrichment] cnpjws_error', { status: response.status, url, body: summary });
    throw new AppError(buildErrorMessage('cnpj.ws', response.status, summary), {
      statusCode: [403, 429].includes(response.status) || response.status >= 500 ? 502 : 422,
      code: 'CNPJWS_ERROR',
      domain: 'clientes-crm',
      details: { status: response.status, body: summary, url },
      expose: true
    });
  }

  try {
    return body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return {};
  }
}

export function buildEnrichmentUpdateFromCnpjWs(payload) {
  return {
    ...normalizeCnpjWsPayload(payload),
    enriquecimento_status: 'concluido',
    enriquecimento_fonte: 'cnpjws',
    enriquecimento_ultima_execucao: new Date().toISOString(),
    enriquecimento_erro: null,
    enriquecimento_payload: payload || {}
  };
}
