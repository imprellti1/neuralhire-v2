import { AppError, DatabaseError, ValidationError } from '../../core/errors.js';

const BRASIL_API_BASE_URL = 'https://brasilapi.com.br/api/cnpj/v1';

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

function buildErrorMessage(status, payload) {
  const detail = payload && typeof payload === 'object'
    ? payload.message || payload.type || payload.error || payload.errors?.[0]?.message || null
    : null;
  return detail ? `BrasilAPI retornou status ${status}: ${detail}` : `BrasilAPI retornou status ${status}`;
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
    response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' } });
  } catch (error) {
    throw new AppError('Falha ao consultar BrasilAPI', {
      statusCode: 502,
      code: 'BRASILAPI_UNAVAILABLE',
      domain: 'clientes-crm',
      details: { message: error?.message || String(error) },
      expose: true
    });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ValidationError(buildErrorMessage(response.status, payload), { domain: 'clientes-crm', code: 'BRASILAPI_REJEITOU_CNPJ' });
  }

  return payload || {};
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
