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
import { BadRequestError, DatabaseError, NotFoundError } from '../../core/errors.js';

const normalizeCnpj = (value) => String(value || '').replace(/\D/g, '') || null;

function assertCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (!cnpj || cnpj.length !== 14) {
    throw new BadRequestError('CNPJ invalido', { code: 'CNPJ_INVALIDO', domain: 'fabricantes' });
  }
  return cnpj;
}

async function lookupPublicCnpj(cnpj) {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    if (response.status === 404) throw new NotFoundError('CNPJ nao encontrado', { code: 'CNPJ_NAO_ENCONTRADO', domain: 'fabricantes' });
    throw new DatabaseError('Falha ao consultar CNPJ', { code: 'CNPJ_LOOKUP_FAILED', domain: 'fabricantes' });
  }
  return response.json();
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
  const source = await lookupPublicCnpj(cnpj);
  return normalizeLookupResponse(source, cnpj);
}
