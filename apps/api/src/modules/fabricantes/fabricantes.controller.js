import {
  createCondicaoPagamento,
  createFabricante,
  getFabricanteById,
  listCondicoesPagamento,
  listFabricantes,
  updateCondicaoPagamento,
  updateFabricante
} from './fabricantes.repository.js';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError, ExternalServiceError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

const normalizeCnpj = (value) => String(value || '').replace(/\D/g, '') || null;

function assertCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (!cnpj || cnpj.length !== 14) {
    throw new BadRequestError('CNPJ invalido', { code: 'CNPJ_INVALIDO', domain: 'fabricantes' });
  }
  return cnpj;
}

async function lookupPublicCnpj(cnpj, context = {}) {
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
  const requestId = context?.requestId || context?.request_id || null;
  const controller = new AbortController();
  const timeoutMs = 8000;
  const timeoutId = setTimeout(() => controller.abort(new Error('CNPJ lookup timeout')), timeoutMs);

  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    let responseText = '';
    let responseBody = null;
    if (typeof response.text === 'function') {
      responseText = await response.text();
      try {
        responseBody = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseBody = responseText;
      }
    } else if (typeof response.json === 'function') {
      responseBody = await response.json();
      responseText = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || {});
    }

    if (!response.ok) {
      logger.error('Falha ao consultar CNPJ externamente', {
        domain: 'fabricantes',
        url,
        requestId,
        status: response.status,
        body: typeof responseText === 'string' ? responseText.slice(0, 1000) : responseBody,
        errorMessage: null,
        errorStack: null
      });

      if (response.status === 404) {
        throw new NotFoundError('CNPJ nao encontrado', { code: 'CNPJ_NAO_ENCONTRADO', domain: 'fabricantes' });
      }
      if (response.status === 400) {
        throw new BadRequestError('CNPJ invalido', { code: 'CNPJ_INVALIDO', domain: 'fabricantes' });
      }
      throw new ExternalServiceError('Nao foi possivel consultar o CNPJ agora. Voce pode continuar com preenchimento manual.', {
        code: 'CNPJ_LOOKUP_FAILED',
        domain: 'fabricantes',
        details: { status: response.status, url }
      });
    }

    return responseBody || {};
  } catch (error) {
    const message = String(error?.message || '');
    const isTimeout = message.toLowerCase().includes('timeout') || error?.name === 'AbortError';
    logger.error('Falha ao consultar CNPJ externamente', {
      domain: 'fabricantes',
      url,
      requestId,
      status: error?.status || null,
      body: null,
      errorMessage: error?.message || null,
      errorStack: error?.stack || null
    });
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ExternalServiceError) {
      throw error;
    }
    if (isTimeout) {
      throw new ExternalServiceError('Nao foi possivel consultar o CNPJ agora. Voce pode continuar com preenchimento manual.', {
        code: 'CNPJ_LOOKUP_TIMEOUT',
        domain: 'fabricantes',
        details: { url, timeoutMs }
      });
    }
    throw new ExternalServiceError('Nao foi possivel consultar o CNPJ agora. Voce pode continuar com preenchimento manual.', {
      code: 'CNPJ_LOOKUP_FAILED',
      domain: 'fabricantes',
      details: { url, reason: error?.message || 'unknown' }
    });
  } finally {
    clearTimeout(timeoutId);
  }
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
        cep: endereco?.cep || source?.cep || ''
      },
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

export async function lookupCnpjHandler(context) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) {
    throw new BadRequestError('Tenant invalido', { code: 'TENANT_REQUIRED', domain: 'fabricantes' });
  }
  const cnpj = assertCnpj(context.params.cnpj || context.body?.cnpj);
  const source = await lookupPublicCnpj(cnpj, context);
  return normalizeLookupResponse(source, cnpj);
}
