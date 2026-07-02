import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { ClientesWriteQueries } from '../../database/queries/clientes-write.queries.js';
import { getUserIdFromContext } from '../../core/commercial-scope.js';
import { findVendedorByUserId } from '../vendedores/vendedores.repository.js';
import { buildEnrichmentUpdateFromBrasilApi, buildEnrichmentUpdateFromCnpjWs, fetchBrasilApiCnpj, fetchCnpjWsCnpj, isValidCnpj, normalizeCnpj } from './clientes.enrichment.js';
import { calcularScoreCliente } from './clientes.score.service.js';
import { geocodificarEndereco, montarEnderecoCliente } from './clientes.geocoding.service.js';

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
  }
}

function normalizeJsonPayload(value, fallback = {}) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return fallback;
}

function normalizeClienteMetadata(metadata, fallback = {}) {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const merged = { ...base, ...fallback };
  return Object.keys(merged).length ? merged : {};
}

function resolveVendedorScope(accountId, context = {}) {
  const role = String(context?.auth?.role || '').toLowerCase();
  if (role !== 'sales') return null;
  const userId = getUserIdFromContext(context);
  return findVendedorByUserId(accountId, userId) || (userId ? { id: userId } : null);
}

function getClienteScopeId(cliente = {}) {
  return String(cliente.vendedor_id || cliente.owner_user_id || '').trim() || null;
}

function isValidCommercialPedido(pedido = {}) {
  const status = String(pedido.status || '').trim().toLowerCase();
  if (!status) return false;
  if (['cancelado', 'rejeitado', 'estornado'].includes(status)) return false;
  const metadata = pedido.metadata && typeof pedido.metadata === 'object' ? pedido.metadata : {};
  if (['cancelado', 'rejeitado', 'estornado'].includes(String(metadata.status || '').trim().toLowerCase())) return false;
  if (['cancelado', 'rejeitado', 'estornado'].includes(String(metadata.situacao || '').trim().toLowerCase())) return false;
  return true;
}

function resolvePurchaseDate(pedido = {}) {
  const candidates = [pedido.data_faturamento, pedido.data_emissao, pedido.created_at, pedido.createdAt];
  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function computeCommercialStatusFromDays(daysSinceLastPurchase) {
  if (!Number.isFinite(daysSinceLastPurchase)) return 'sem_pedido';
  if (daysSinceLastPurchase <= 60) return 'ativo';
  if (daysSinceLastPurchase <= 120) return 'em_risco';
  return 'inativo';
}

function buildClienteInsertPayload(data = {}, accountId, context = {}) {
  const vendedor = resolveVendedorScope(accountId, context);
  return {
    id: randomUUID(),
    account_id: accountId,
    nome: data.nome,
    codigo: data.codigo ?? null,
    documento: data.documento || null,
    email: data.email || null,
    telefone: data.telefone || null,
    site: data.site || data.website || null,
    cidade: data.cidade || null,
    estado: data.estado || null,
    status: data.status || null,
    logradouro: data.logradouro || null,
    numero: data.numero || null,
    complemento: data.complemento || null,
    bairro: data.bairro || null,
    cep: data.cep || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
    metadata: normalizeClienteMetadata(data.metadata, data.metadata_importacao),
    vendedor_id: vendedor?.id || data.vendedor_id || null,
    razao_social: data.razao_social || null,
    digital_enrichment_payload: normalizeJsonPayload(data.digital_enrichment_payload ?? {}, {}),
    digital_enrichment_status: data.digital_enrichment_status || null,
    digital_enrichment_updated_at: data.digital_enrichment_updated_at || null,
    enriquecimento_status: data.enriquecimento_status || null,
    enriquecimento_fonte: data.enriquecimento_fonte || null,
    enriquecimento_ultima_execucao: data.enriquecimento_ultima_execucao || null,
    enriquecimento_erro: data.enriquecimento_erro || null,
    enriquecimento_payload: normalizeJsonPayload(data.enriquecimento_payload ?? {}, {}),
    geolocalizacao_status: data.geolocalizacao_status || null,
    geolocalizacao_fonte: data.geolocalizacao_fonte || null,
    geolocalizacao_erro: data.geolocalizacao_erro || null,
    geolocalizacao_ultima_execucao: data.geolocalizacao_ultima_execucao || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    google_maps_url: data.google_maps_url || null,
    google_place_id: data.google_place_id || null,
    cliente_score: data.cliente_score ?? null,
    cliente_classificacao: data.cliente_classificacao || null,
    cliente_potencial: data.cliente_potencial || null,
    cliente_score_ultima_execucao: data.cliente_score_ultima_execucao || null,
    cliente_score_fatores: normalizeJsonPayload(data.cliente_score_fatores ?? {}, {}),
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    owner_user_id: vendedor?.id || data.owner_user_id || null
  };
}

function buildClienteUpdatePayload(current = {}, data = {}, accountId, context = {}) {
  const role = String(context?.auth?.role || '').toLowerCase();
  const vendedor = role === 'sales' ? resolveVendedorScope(accountId, context) : null;
  const next = { ...current };
  if (data.nome !== undefined) next.nome = data.nome;
  if (data.razao_social !== undefined) next.razao_social = data.razao_social || null;
  if (data.codigo !== undefined) next.codigo = data.codigo ?? null;
  if (data.documento !== undefined) next.documento = data.documento || null;
  if (data.email !== undefined) next.email = data.email || null;
  if (data.telefone !== undefined) next.telefone = data.telefone || null;
  if (data.site !== undefined) next.site = data.site || data.website || null;
  if (data.cidade !== undefined) next.cidade = data.cidade || null;
  if (data.estado !== undefined) next.estado = data.estado || null;
  if (data.status !== undefined) next.status = data.status || null;
  if (data.logradouro !== undefined) next.logradouro = data.logradouro || null;
  if (data.numero !== undefined) next.numero = data.numero || null;
  if (data.complemento !== undefined) next.complemento = data.complemento || null;
  if (data.bairro !== undefined) next.bairro = data.bairro || null;
  if (data.cep !== undefined) next.cep = data.cep || null;
  if (data.tags !== undefined) next.tags = Array.isArray(data.tags) ? data.tags : [];
  if (data.ativo !== undefined) next.ativo = typeof data.ativo === 'boolean' ? data.ativo : current.ativo;
  if (data.metadata !== undefined) next.metadata = normalizeClienteMetadata(data.metadata);
  if (data.digital_enrichment_payload !== undefined) next.digital_enrichment_payload = normalizeJsonPayload(data.digital_enrichment_payload, {});
  if (data.digital_enrichment_status !== undefined) next.digital_enrichment_status = data.digital_enrichment_status || null;
  if (data.digital_enrichment_updated_at !== undefined) next.digital_enrichment_updated_at = data.digital_enrichment_updated_at || null;
  if (data.enriquecimento_status !== undefined) next.enriquecimento_status = data.enriquecimento_status || null;
  if (data.enriquecimento_fonte !== undefined) next.enriquecimento_fonte = data.enriquecimento_fonte || null;
  if (data.enriquecimento_ultima_execucao !== undefined) next.enriquecimento_ultima_execucao = data.enriquecimento_ultima_execucao || null;
  if (data.enriquecimento_erro !== undefined) next.enriquecimento_erro = data.enriquecimento_erro || null;
  if (data.enriquecimento_payload !== undefined) next.enriquecimento_payload = normalizeJsonPayload(data.enriquecimento_payload, {});
  if (data.geolocalizacao_status !== undefined) next.geolocalizacao_status = data.geolocalizacao_status || null;
  if (data.geolocalizacao_fonte !== undefined) next.geolocalizacao_fonte = data.geolocalizacao_fonte || null;
  if (data.geolocalizacao_erro !== undefined) next.geolocalizacao_erro = data.geolocalizacao_erro || null;
  if (data.geolocalizacao_ultima_execucao !== undefined) next.geolocalizacao_ultima_execucao = data.geolocalizacao_ultima_execucao || null;
  if (data.latitude !== undefined) next.latitude = data.latitude ?? null;
  if (data.longitude !== undefined) next.longitude = data.longitude ?? null;
  if (data.google_maps_url !== undefined) next.google_maps_url = data.google_maps_url || null;
  if (data.google_place_id !== undefined) next.google_place_id = data.google_place_id || null;
  if (data.cliente_score !== undefined) next.cliente_score = data.cliente_score ?? null;
  if (data.cliente_classificacao !== undefined) next.cliente_classificacao = data.cliente_classificacao || null;
  if (data.cliente_potencial !== undefined) next.cliente_potencial = data.cliente_potencial || null;
  if (data.cliente_score_ultima_execucao !== undefined) next.cliente_score_ultima_execucao = data.cliente_score_ultima_execucao || null;
  if (data.cliente_score_fatores !== undefined) next.cliente_score_fatores = normalizeJsonPayload(data.cliente_score_fatores, {});
  if (role === 'sales') next.vendedor_id = vendedor?.id || getClienteScopeId(current) || null;
  else if (data.vendedor_id !== undefined) next.vendedor_id = data.vendedor_id || null;
  next.owner_user_id = next.vendedor_id || current.owner_user_id || null;
  next.updated_at = new Date().toISOString();
  return next;
}

export class ClientesWriteRepository extends BaseRepository {
  constructor(databaseAdapter) {
    super(databaseAdapter, { logContext: 'clientes-write' });
  }

  async create(data, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    const payload = buildClienteInsertPayload(data, accountId, options.context || {});
    return this.one(ClientesWriteQueries.insert(), [
      payload.id, payload.account_id, payload.nome, payload.codigo, payload.documento, payload.email, payload.telefone,
      payload.site, payload.cidade, payload.estado, payload.status, payload.logradouro, payload.numero, payload.complemento,
      payload.bairro, payload.cep, payload.tags, payload.ativo, payload.metadata, payload.vendedor_id, payload.razao_social,
      payload.digital_enrichment_payload, payload.digital_enrichment_status, payload.digital_enrichment_updated_at,
      payload.enriquecimento_status, payload.enriquecimento_fonte, payload.enriquecimento_ultima_execucao, payload.enriquecimento_erro,
      payload.enriquecimento_payload, payload.geolocalizacao_status, payload.geolocalizacao_fonte, payload.geolocalizacao_erro,
      payload.geolocalizacao_ultima_execucao, payload.latitude, payload.longitude, payload.google_maps_url, payload.google_place_id,
      payload.cliente_score, payload.cliente_classificacao, payload.cliente_potencial, payload.cliente_score_ultima_execucao,
      payload.cliente_score_fatores, payload.updated_at, payload.created_at, payload.owner_user_id
    ]);
  }

  async update(id, data, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    const current = await this.one(ClientesWriteQueries.getById(), [accountId, id]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') {
        throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
      }
      throw error;
    });
    const next = buildClienteUpdatePayload(current, data, accountId, options.context || {});
    return this.one(ClientesWriteQueries.update(), [
      accountId, id, next.nome, next.codigo, next.documento, next.email, next.telefone, next.site, next.cidade, next.estado,
      next.status, next.logradouro, next.numero, next.complemento, next.bairro, next.cep, next.tags, next.ativo, next.metadata,
      next.vendedor_id, next.razao_social, next.digital_enrichment_payload, next.digital_enrichment_status, next.digital_enrichment_updated_at,
      next.enriquecimento_status, next.enriquecimento_fonte, next.enriquecimento_ultima_execucao, next.enriquecimento_erro,
      next.enriquecimento_payload, next.geolocalizacao_status, next.geolocalizacao_fonte, next.geolocalizacao_erro,
      next.geolocalizacao_ultima_execucao, next.latitude, next.longitude, next.google_maps_url, next.google_place_id,
      next.cliente_score, next.cliente_classificacao, next.cliente_potencial, next.cliente_score_ultima_execucao,
      next.cliente_score_fatores, next.updated_at, next.owner_user_id
    ]);
  }

  patch(id, data, options = {}) {
    return this.update(id, data, options);
  }

  deleteOrArchive(id, data = {}, options = {}) {
    return this.update(id, { ...data, ativo: false }, options);
  }

  updateDigitalEnrichment(id, data, options = {}) {
    return this.update(id, data, options);
  }

  async enrichByCnpj(clienteId, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    const cliente = await this.one(ClientesWriteQueries.getById(), [accountId, clienteId]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') {
        throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
      }
      throw error;
    });
    const cnpj = normalizeCnpj(cliente?.documento);
    if (!isValidCnpj(cnpj)) {
      const erro = 'CNPJ ausente ou invalido';
      await this.one(ClientesWriteQueries.updateEnrichment(), [
        accountId, cliente.id, cliente.razao_social || null, cliente.nome_fantasia || null, cliente.cnae_principal || null, cliente.situacao_cadastral || null,
        cliente.data_abertura || null, cliente.cep || null, cliente.logradouro || null, cliente.numero || null, cliente.complemento || null,
        cliente.bairro || null, cliente.cidade || null, cliente.estado || null, cliente.email_enriquecido || null, cliente.telefone_enriquecido || null,
        'erro', 'brasilapi', new Date().toISOString(), erro, cliente.enriquecimento_payload || {}, new Date().toISOString()
      ]);
      throw new ValidationError(erro, { domain: 'clientes-crm', code: 'CNPJ_INVALIDO' });
    }

    try {
      const payload = await fetchBrasilApiCnpj(cnpj, { fetchImpl: options.fetchImpl });
      const update = buildEnrichmentUpdateFromBrasilApi(payload);
      return this.one(ClientesWriteQueries.updateEnrichment(), [
        accountId, cliente.id, update.razao_social || null, update.nome_fantasia || null, update.cnae_principal || null, update.situacao_cadastral || null,
        update.data_abertura || null, update.cep || null, update.logradouro || null, update.numero || null, update.complemento || null,
        update.bairro || null, update.cidade || null, update.estado || null, update.email_enriquecido || null, update.telefone_enriquecido || null,
        update.enriquecimento_status, update.enriquecimento_fonte, update.enriquecimento_ultima_execucao, update.enriquecimento_erro,
        update.enriquecimento_payload, new Date().toISOString()
      ]);
    } catch (error) {
      const brasilApiError = error;
      const fallbackEligible = [403, 429].includes(Number(brasilApiError?.details?.status || brasilApiError?.statusCode || brasilApiError?.status || 0)) || Number(brasilApiError?.details?.status || brasilApiError?.statusCode || brasilApiError?.status || 0) >= 500;
      if (fallbackEligible) {
        try {
          const cnpjWsPayload = await fetchCnpjWsCnpj(cnpj, { fetchImpl: options.fetchImpl });
          const update = buildEnrichmentUpdateFromCnpjWs(cnpjWsPayload);
          return this.one(ClientesWriteQueries.updateEnrichment(), [
            accountId, cliente.id, update.razao_social || null, update.nome_fantasia || null, update.cnae_principal || null, update.situacao_cadastral || null,
            update.data_abertura || null, update.cep || null, update.logradouro || null, update.numero || null, update.complemento || null,
            update.bairro || null, update.cidade || null, update.estado || null, update.email_enriquecido || null, update.telefone_enriquecido || null,
            update.enriquecimento_status, update.enriquecimento_fonte, update.enriquecimento_ultima_execucao, update.enriquecimento_erro,
            update.enriquecimento_payload, new Date().toISOString()
          ]);
        } catch (cnpjWsError) {
          throw new DatabaseError('Nao foi possivel consultar o CNPJ nas fontes disponiveis.', { domain: 'clientes-crm', details: { brasilapi: brasilApiError?.message || String(brasilApiError), cnpjws: cnpjWsError?.message || String(cnpjWsError) } });
        }
      }
      throw brasilApiError;
    }
  }

  async geolocalizarCliente(input = {}) {
    const accountId = input.accountId || null;
    assertAccountId(accountId);
    const clienteId = input.clienteId || input.id || null;
    const cliente = await this.one(ClientesWriteQueries.getById(), [accountId, clienteId]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') {
        throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
      }
      throw error;
    });
    const endereco_consultado = montarEnderecoCliente(cliente);
    const resultadoBase = await geocodificarEndereco(endereco_consultado, { fetchImpl: input.fetchImpl });
    const updated = await this.one(ClientesWriteQueries.updateGeolocation(), [
      accountId, cliente.id, resultadoBase.status, resultadoBase.fonte || 'nominatim', resultadoBase.erro || null, new Date().toISOString(),
      resultadoBase.status === 'sucesso' ? resultadoBase.latitude : null,
      resultadoBase.status === 'sucesso' ? resultadoBase.longitude : null,
      resultadoBase.status === 'sucesso' ? resultadoBase.google_maps_url : null,
      resultadoBase.status === 'sucesso' ? resultadoBase.google_place_id || null : null,
      new Date().toISOString()
    ]);
    return { cliente: updated, endereco_consultado, resultado: resultadoBase };
  }

  async calcularScoreComercialCliente(input = {}) {
    const accountId = input.accountId || null;
    assertAccountId(accountId);
    const clienteId = input.clienteId || null;
    const cliente = await this.one(ClientesWriteQueries.getById(), [accountId, clienteId]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') {
        throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
      }
      throw error;
    });
    const pedidos = await this.many(ClientesWriteQueries.listPedidosByCliente(), [accountId, cliente.id]);
    const pedidosValidos = (Array.isArray(pedidos) ? pedidos : []).filter(isValidCommercialPedido);
    const itens = pedidosValidos.length
      ? await this.many(ClientesWriteQueries.listPedidoItensByPedidos(), [accountId, pedidosValidos.map((pedido) => pedido.id)])
      : [];
    const scoreResult = calcularScoreCliente({ cliente, pedidos: pedidosValidos, itens });
    const updated = await this.one(ClientesWriteQueries.updateCommercialScore(), [
      accountId, cliente.id, scoreResult.score, scoreResult.classificacao, scoreResult.potencial, new Date().toISOString(), scoreResult.fatores, new Date().toISOString()
    ]);
    return { cliente: updated, score: scoreResult };
  }
}

export const clientesWriteRepository = new ClientesWriteRepository(database);
