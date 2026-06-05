import {
  deleteCondicaoPagamento,
  createCondicaoPagamento,
  createFabricante,
  getFabricanteById,
  listCondicoesPagamento,
  listFabricantes,
  updateCondicaoPagamento,
  updateFabricante
} from './fabricantes.repository.js';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

const normalizeCnpj = (value) => String(value || '').replace(/\D/g, '') || null;

function assertCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (!cnpj || cnpj.length !== 14) {
    throw new BadRequestError('CNPJ invalido', { code: 'CNPJ_INVALIDO', domain: 'fabricantes' });
  }
  return cnpj;
}

const FALLBACK_CNPJ_MESSAGE = 'Nao foi possivel consultar o CNPJ agora. Voce pode continuar com preenchimento manual.';

function truncateBody(body) {
  if (body == null) return null;
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
}

function firstMeaningful(...values) {
  return values.find((value) => String(value || '').trim()) || '';
}

function composeStreetName(prefix, street) {
  return [prefix, street].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

function buildEnderecoCompleto(endereco = {}) {
  const parts = [
    [endereco?.logradouro, endereco?.numero].filter(Boolean).join(', ').trim(),
    endereco?.complemento,
    [endereco?.bairro, endereco?.cidade, endereco?.uf].filter(Boolean).join(' - ').trim(),
    endereco?.cep,
    endereco?.pais
  ].filter((part) => String(part || '').trim());
  return parts.join(' | ');
}

async function fetchJsonWithTimeout(url, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('CNPJ lookup timeout')), timeoutMs);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    let responseText = '';
    let body = null;
    if (typeof response.text === 'function') {
      responseText = await response.text();
      try {
        body = responseText ? JSON.parse(responseText) : null;
      } catch {
        body = responseText;
      }
    } else if (typeof response.json === 'function') {
      body = await response.json();
      responseText = typeof body === 'string' ? body : JSON.stringify(body || {});
    }
    return { response, body, bodyText: responseText };
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldFallback(status, error) {
  if (error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.name === 'AbortError' || message.includes('timeout') || message.includes('fetch');
  }
  return [403, 429].includes(status) || (status >= 500 && status < 600);
}

function isSparseBrasilApiResponse(body = {}) {
  const meaningfulFields = [
    body?.nome_fantasia,
    body?.logradouro,
    body?.numero,
    body?.bairro,
    body?.municipio,
    body?.uf,
    body?.cep,
    body?.email,
    body?.ddd_telefone_1
  ].filter((value) => String(value || '').trim());
  return meaningfulFields.length === 0;
}

function buildProviderData(provider, cnpj, body) {
  if (provider === 'brasilapi') {
    return {
      cnpj,
      razao_social: body?.razao_social || '',
      nome: body?.nome || body?.nome_fantasia || '',
      nome_fantasia: body?.nome_fantasia || body?.nome || '',
      situacao: body?.descricao_situacao_cadastral || '',
      email: body?.email || '',
      telefone: body?.ddd_telefone_1 || '',
      site: body?.website || '',
      endereco: {
        logradouro: body?.logradouro || '',
        numero: body?.numero || '',
        complemento: body?.complemento || '',
        bairro: body?.bairro || '',
        cidade: body?.municipio || '',
        uf: body?.uf || '',
        cep: body?.cep || '',
        pais: body?.pais || ''
      },
      logradouro: body?.logradouro || '',
      numero: body?.numero || '',
      complemento: body?.complemento || '',
      bairro: body?.bairro || '',
      cidade: body?.municipio || '',
      uf: body?.uf || '',
      cep: body?.cep || '',
      endereco_completo: buildEnderecoCompleto({
        logradouro: body?.logradouro || '',
        numero: body?.numero || '',
        complemento: body?.complemento || '',
        bairro: body?.bairro || '',
        cidade: body?.municipio || '',
        uf: body?.uf || '',
        cep: body?.cep || '',
        pais: body?.pais || ''
      }),
      atividade_principal: body?.cnae_fiscal_descricao || ''
    };
  }

  return {
    cnpj,
    razao_social: firstMeaningful(body?.razao_social, body?.nome, body?.razaoSocial),
    nome: firstMeaningful(body?.nome_fantasia, body?.nome, body?.razao_social, body?.razaoSocial),
    nome_fantasia: firstMeaningful(body?.nome_fantasia, body?.nome, body?.razao_social, body?.razaoSocial),
    situacao: body?.situacao_cadastral || body?.situacao || '',
    email: firstMeaningful(body?.email, body?.emails?.[0]?.email),
    telefone: firstMeaningful(
      body?.telefone,
      body?.telefones?.[0]?.ddd && body?.telefones?.[0]?.numero ? `${body.telefones[0].ddd}${body.telefones[0].numero}` : '',
      body?.telefones?.[0]?.numero,
      body?.telefones?.[1]?.ddd && body?.telefones?.[1]?.numero ? `${body.telefones[1].ddd}${body.telefones[1].numero}` : '',
      body?.telefones?.[1]?.numero
    ),
    site: firstMeaningful(body?.site, body?.website),
    endereco: {
      logradouro: composeStreetName(body?.estabelecimento?.tipo_logradouro, body?.estabelecimento?.logradouro || body?.logradouro || body?.endereco?.logradouro || ''),
      numero: body?.estabelecimento?.numero || body?.numero || body?.endereco?.numero || '',
      complemento: body?.estabelecimento?.complemento || body?.complemento || body?.endereco?.complemento || '',
      bairro: body?.estabelecimento?.bairro || body?.bairro || body?.endereco?.bairro || '',
      cidade: body?.estabelecimento?.cidade?.nome || body?.municipio || body?.cidade || body?.endereco?.cidade || '',
      uf: body?.estabelecimento?.estado?.sigla || body?.uf || body?.endereco?.uf || '',
      cep: body?.estabelecimento?.cep || body?.cep || body?.endereco?.cep || '',
      pais: body?.pais || body?.endereco?.pais || ''
    },
    logradouro: composeStreetName(body?.estabelecimento?.tipo_logradouro, body?.estabelecimento?.logradouro || body?.logradouro || body?.endereco?.logradouro || ''),
    numero: body?.estabelecimento?.numero || body?.numero || body?.endereco?.numero || '',
    complemento: body?.estabelecimento?.complemento || body?.complemento || body?.endereco?.complemento || '',
    bairro: body?.estabelecimento?.bairro || body?.bairro || body?.endereco?.bairro || '',
    cidade: body?.estabelecimento?.cidade?.nome || body?.municipio || body?.cidade || body?.endereco?.cidade || '',
    uf: body?.estabelecimento?.estado?.sigla || body?.uf || body?.endereco?.uf || '',
    cep: body?.estabelecimento?.cep || body?.cep || body?.endereco?.cep || '',
    endereco_completo: buildEnderecoCompleto({
      logradouro: composeStreetName(body?.estabelecimento?.tipo_logradouro, body?.estabelecimento?.logradouro || body?.logradouro || body?.endereco?.logradouro || ''),
      numero: body?.estabelecimento?.numero || body?.numero || body?.endereco?.numero || '',
      complemento: body?.estabelecimento?.complemento || body?.complemento || body?.endereco?.complemento || '',
      bairro: body?.estabelecimento?.bairro || body?.bairro || body?.endereco?.bairro || '',
      cidade: body?.estabelecimento?.cidade?.nome || body?.municipio || body?.cidade || body?.endereco?.cidade || '',
      uf: body?.estabelecimento?.estado?.sigla || body?.uf || body?.endereco?.uf || '',
      cep: body?.estabelecimento?.cep || body?.cep || body?.endereco?.cep || '',
      pais: body?.pais || body?.endereco?.pais || ''
    }),
    atividade_principal: body?.atividade_principal || body?.atividade || body?.atividade_principal?.descricao || ''
  };
}

async function lookupPublicCnpj(cnpj, context = {}) {
  const requestId = context?.requestId || context?.request_id || null;
  const providers = [
    { name: 'brasilapi', url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}` },
    { name: 'cnpjws', url: `https://publica.cnpj.ws/cnpj/${cnpj}` }
  ];

  for (const provider of providers) {
    try {
      const { response, body, bodyText } = await fetchJsonWithTimeout(provider.url);
      logger.info('Consulta de CNPJ externa concluida', {
        domain: 'fabricantes',
        provider: provider.name,
        url: provider.url,
        requestId,
        status: response.status,
        body: truncateBody(body),
        errorMessage: null
      });
      if (!response.ok && shouldFallback(response.status)) continue;
      if (!response.ok) continue;
      if (provider.name === 'brasilapi' && isSparseBrasilApiResponse(body)) continue;
      return { ok: true, found: true, data: buildProviderData(provider.name, cnpj, body) };
    } catch (error) {
      logger.error('Falha ao consultar CNPJ externamente', {
        domain: 'fabricantes',
        provider: provider.name,
        url: provider.url,
        requestId,
        status: error?.status || null,
        body: truncateBody(error?.body || null),
        errorMessage: error?.message || null,
        errorStack: error?.stack || null
      });
      if (shouldFallback(null, error)) continue;
    }
  }

  return {
    ok: true,
    found: false,
    message: FALLBACK_CNPJ_MESSAGE,
    data: null
  };
}

function normalizeLookupResponse(source, cnpj) {
  const endereco = source?.address || source?.endereco || {};
  const atividade = Array.isArray(source?.cnae_fiscal_detalhes) ? source.cnae_fiscal_detalhes[0]?.descricao : null;
  return {
    ok: true,
    data: {
      cnpj,
      razao_social: source?.razao_social || source?.razaoSocial || source?.social_name || '',
      nome: source?.nome || source?.nome_fantasia || source?.trade_name || '',
      nome_fantasia: source?.nome_fantasia || source?.trade_name || source?.nome || '',
      situacao: source?.descricao_situacao_cadastral || source?.situacao_cadastral || source?.situacao || '',
      email: source?.email || '',
      telefone: source?.ddd_telefone_1 || source?.telefone || source?.telefone1 || '',
      site: source?.website || source?.site || '',
      endereco: {
        logradouro: endereco?.logradouro || source?.logradouro || '',
        numero: endereco?.numero || source?.numero || '',
        complemento: endereco?.complemento || source?.complemento || '',
        bairro: endereco?.bairro || source?.bairro || '',
        cidade: endereco?.municipio || endereco?.cidade || source?.municipio || source?.cidade || '',
        uf: endereco?.uf || source?.uf || '',
        cep: endereco?.cep || source?.cep || '',
        pais: endereco?.pais || source?.pais || ''
      },
      logradouro: endereco?.logradouro || source?.logradouro || '',
      numero: endereco?.numero || source?.numero || '',
      complemento: endereco?.complemento || source?.complemento || '',
      bairro: endereco?.bairro || source?.bairro || '',
      cidade: endereco?.municipio || endereco?.cidade || source?.municipio || source?.cidade || '',
      uf: endereco?.uf || source?.uf || '',
      cep: endereco?.cep || source?.cep || '',
      endereco_completo: buildEnderecoCompleto({
        logradouro: endereco?.logradouro || source?.logradouro || '',
        numero: endereco?.numero || source?.numero || '',
        complemento: endereco?.complemento || source?.complemento || '',
        bairro: endereco?.bairro || source?.bairro || '',
        cidade: endereco?.municipio || endereco?.cidade || source?.municipio || source?.cidade || '',
        uf: endereco?.uf || source?.uf || '',
        cep: endereco?.cep || source?.cep || '',
        pais: endereco?.pais || source?.pais || ''
      }),
      atividade_principal: atividade || source?.cnae_fiscal_descricao || source?.atividade_principal || ''
    }
  };
}

export async function getFabricantes(context) {
  const accountId = getAccountIdFromContext(context);
  return listFabricantes(context.query || {}, { accountId });
}

export async function getFabricante(context) {
  const accountId = getAccountIdFromContext(context);
  return getFabricanteById(context.params.id, { accountId });
}

export async function createFabricanteHandler(context) {
  const body = context.body || {};
  const accountId = getAccountIdFromContext(context);
  return createFabricante({ ...body, nome: body.nome || body.nome_fantasia || body.razao_social || '', cnpj: body.cnpj ? normalizeCnpj(body.cnpj) : null }, { accountId });
}

export async function updateFabricanteHandler(context) {
  const body = context.body || {};
  const accountId = getAccountIdFromContext(context);
  return updateFabricante(context.params.id, { ...body, nome: body.nome || body.nome_fantasia || body.razao_social || body.nome, cnpj: body.cnpj ? normalizeCnpj(body.cnpj) : body.cnpj }, { accountId });
}

export async function getCondicoesPagamento(context) {
  const accountId = getAccountIdFromContext(context);
  return listCondicoesPagamento(context.params.id, { accountId });
}

export async function createCondicaoPagamentoHandler(context) {
  const accountId = getAccountIdFromContext(context);
  return createCondicaoPagamento(context.params.id, context.body || {}, { accountId });
}

export async function updateCondicaoPagamentoHandler(context) {
  const accountId = getAccountIdFromContext(context);
  return updateCondicaoPagamento(context.params.id, context.params.condicaoId, context.body || {}, { accountId });
}

export async function deleteCondicaoPagamentoHandler(context) {
  const accountId = getAccountIdFromContext(context);
  return deleteCondicaoPagamento(context.params.id, context.params.condicaoId, { accountId });
}

export async function lookupCnpjHandler(context) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) {
    throw new BadRequestError('Tenant invalido', { code: 'TENANT_REQUIRED', domain: 'fabricantes' });
  }
  const cnpj = assertCnpj(context.params.cnpj || context.body?.cnpj);
  const source = await lookupPublicCnpj(cnpj, context);
  if (source && source.ok === true && source.found === false) {
    return source;
  }
  return source?.data ? { ok: true, data: normalizeLookupResponse(source.data, cnpj).data } : normalizeLookupResponse(source, cnpj);
}
