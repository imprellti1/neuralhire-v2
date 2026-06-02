import {
  createCondicaoPagamento,
  createFabricante,
  getFabricanteById,
  listCondicoesPagamento,
  listFabricantes,
  updateCondicaoPagamento,
  updateFabricante
} from './fabricantes.repository.js';

const normalizeCnpj = (value) => String(value || '').replace(/\D/g, '') || null;

export async function getFabricantes(context) {
  return listFabricantes(context.query || {}, { accountId: context.accountId });
}

export async function getFabricante(context) {
  return getFabricanteById(context.params.id, { accountId: context.accountId });
}

export async function createFabricanteHandler(context) {
  const body = context.body || {};
  return createFabricante({ ...body, cnpj: body.cnpj ? normalizeCnpj(body.cnpj) : null }, { accountId: context.accountId });
}

export async function updateFabricanteHandler(context) {
  const body = context.body || {};
  return updateFabricante(context.params.id, { ...body, cnpj: body.cnpj ? normalizeCnpj(body.cnpj) : body.cnpj }, { accountId: context.accountId });
}

export async function getCondicoesPagamento(context) {
  return listCondicoesPagamento(context.params.id, { accountId: context.accountId });
}

export async function createCondicaoPagamentoHandler(context) {
  return createCondicaoPagamento(context.params.id, context.body || {}, { accountId: context.accountId });
}

export async function updateCondicaoPagamentoHandler(context) {
  return updateCondicaoPagamento(context.params.id, context.params.condicaoId, context.body || {}, { accountId: context.accountId });
}
