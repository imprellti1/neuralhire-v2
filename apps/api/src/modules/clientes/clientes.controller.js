import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { NotFoundError, ValidationError } from '../../core/errors.js';
import { applyOwnerFilter, canAccessAllTenantData } from '../../core/commercial-scope.js';
import { calcularScoreComercialCliente, createCliente, enrichClienteByCnpj, geolocalizarCliente, getClienteById, getClientesRepositoryMode, listClientes, updateCliente } from './clientes.repository.js';
import { recalcularSegmentacaoCliente } from './clientes.segmentacao.service.js';
import { gerarAlertasCliente, listAlertasCliente, resolverAlertaCliente } from './clientes.alerts.service.js';
import { listarTimelineCliente, registrarEventoTimeline } from './clientes.timeline.service.js';
import { recordAuditLog } from '../../core/audit-logs.js';
import { getGruposComerciaisByClienteId } from '../grupos-comerciais/grupos-comerciais.repository.js';

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

async function registrarEventoTimelineComLog(contexto, evento, options) {
  console.debug('[clientes.controller] timeline_before', {
    etapa: evento?.categoria || evento?.tipo || null,
    accountId: options?.accountId || null,
    clienteId: options?.clienteId || null,
    tipo: evento?.tipo || null,
    categoria: evento?.categoria || null
  });
  try {
    const resultado = await registrarEventoTimeline(evento, options);
    console.debug('[clientes.controller] timeline_after', {
      etapa: evento?.categoria || evento?.tipo || null,
      accountId: options?.accountId || null,
      clienteId: options?.clienteId || null,
      id: resultado?.id || null,
      created_at: resultado?.created_at || null
    });
    return resultado;
  } catch (error) {
    console.error('timeline_error', {
      message: error?.message || null,
      code: error?.code || error?.details?.code || null,
      details: error?.details || null,
      hint: error?.hint || error?.details?.hint || null,
      accountId: options?.accountId || null,
      clienteId: options?.clienteId || null,
      categoria: evento?.categoria || null,
      tipo: evento?.tipo || null,
      titulo: evento?.titulo || null
    });
    return null;
  }
}

export async function getClientes(context = {}) {
  const query = context.query || {};
  const accountId = getAccountIdFromContext(context);
  const filters = {
    page: query.page !== undefined ? Number(query.page) : undefined,
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    search: query.search,
    ativo: parseBoolean(query.ativo)
  };
  const scopedFilters = applyOwnerFilter(context, filters);

  const result = await listClientes(scopedFilters, { accountId, context });
  return {
    ok: true,
    repositoryMode: getClientesRepositoryMode(),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages
    },
    items: result.items
  };
}

export async function createClienteHandler(context) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id;
  delete body.accountId;
  if (String(context?.auth?.role || '').toLowerCase() === 'sales') {
    body.vendedor_id = context?.auth?.userId || null;
  }
  if (!canAccessAllTenantData(context) && String(context?.auth?.role || '').toLowerCase() !== 'sales') {
    delete body.vendedor_id;
  }

  const item = await createCliente(body, { accountId, context });
  await registrarEventoTimelineComLog(context, {
    tipo: 'cliente_cadastrado',
    categoria: 'cadastro',
    titulo: 'Cliente cadastrado',
    descricao: 'Cadastro do cliente concluído.',
    referencia_id: item?.id || null,
    metadata: { cliente_id: item?.id || null, nome: item?.nome || body.nome || null }
  }, { accountId, clienteId: item?.id || null });
  await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: item?.id || null, acao: 'criar', descricao: 'Cliente criado', status: 'success', sucesso: true, metadata: { cliente_id: item?.id || null, nome: item?.nome || body.nome || null } }).catch(() => null);
  return {
    ok: true,
    repositoryMode: getClientesRepositoryMode(),
    item
  };
}

export async function getClienteByIdHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  try {
    const item = await getClienteById(id, { accountId, context });
    const gruposComerciais = await getGruposComerciaisByClienteId(id, { accountId }).catch(() => []);
    return { ok: true, repositoryMode: getClientesRepositoryMode(), item: { ...item, gruposComerciais } };
  } catch (error) {
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN' || error?.code === 'VENDEDOR_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}

export async function updateClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  const body = { ...(context.body || {}) };
  delete body.account_id;
  delete body.accountId;
  if (String(context?.auth?.role || '').toLowerCase() === 'sales') {
    delete body.vendedor_id;
  }
  try {
    const item = await updateCliente(id, body, { accountId, context });
    await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: id, acao: 'editar', descricao: 'Cliente editado', status: 'success', sucesso: true, metadata: { cliente_id: id } }).catch(() => null);
    return { ok: true, repositoryMode: getClientesRepositoryMode(), item };
  } catch (error) {
    await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: id, acao: 'editar', descricao: 'Falha ao editar cliente', status: 'failed', sucesso: false, erro_codigo: error?.code || 'INTERNAL_SERVER_ERROR', erro_mensagem: error?.message || 'Erro ao editar cliente' }).catch(() => null);
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN' || error?.code === 'VENDEDOR_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}

export async function enrichClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  try {
    const item = await enrichClienteByCnpj(id, { accountId, context, fetchImpl: context.fetchImpl });
    await registrarEventoTimelineComLog(context, {
      tipo: 'cliente_enriquecido',
      categoria: 'enriquecimento',
      titulo: 'Enriquecimento concluído',
      descricao: 'Os dados cadastrais do cliente foram enriquecidos com sucesso.',
      referencia_id: id,
      metadata: { cliente_id: id, fonte: 'brasilapi' }
    }, { accountId, clienteId: id });
    await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: id, acao: 'enriquecer', descricao: 'Cliente enriquecido', status: 'success', sucesso: true, metadata: { cliente_id: id, fonte: 'brasilapi' } }).catch(() => null);
    return { ok: true, repositoryMode: getClientesRepositoryMode(), item };
  } catch (error) {
    await recordAuditLog(context, { modulo: 'clientes', entidade: 'cliente', entidade_id: id, acao: 'enriquecer', descricao: 'Falha ao enriquecer cliente', status: 'failed', sucesso: false, erro_codigo: error?.code || 'INTERNAL_SERVER_ERROR', erro_mensagem: error?.message || 'Erro ao enriquecer cliente' }).catch(() => null);
    throw error;
  }
}

export async function geolocalizarClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  try {
    const result = await geolocalizarCliente({ accountId, clienteId: id, fetchImpl: context.fetchImpl, context });
    await registrarEventoTimelineComLog(context, {
      tipo: 'cliente_geolocalizado',
      categoria: 'geolocalizacao',
      titulo: 'Cliente geolocalizado',
      descricao: 'A geolocalização do cliente foi atualizada.',
      referencia_id: id,
      metadata: { cliente_id: id, status: result?.resultado?.status || null }
    }, { accountId, clienteId: id });
    return { ok: true, repositoryMode: getClientesRepositoryMode(), item: result?.cliente || null, ...result };
  } catch (error) {
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN' || error?.code === 'VENDEDOR_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}

export async function calcularScoreClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  try {
    const result = await calcularScoreComercialCliente({ accountId, clienteId: id, context });
    await registrarEventoTimelineComLog(context, {
      tipo: 'score_atualizado',
      categoria: 'score',
      titulo: 'Score atualizado',
      descricao: 'O score comercial do cliente foi recalculado.',
      referencia_id: id,
      metadata: { cliente_id: id, score: result?.score?.score ?? result?.cliente?.cliente_score ?? null }
    }, { accountId, clienteId: id });
    return { ok: true, repositoryMode: getClientesRepositoryMode(), ...result };
  } catch (error) {
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN' || error?.code === 'VENDEDOR_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}

export async function calcularSegmentacaoClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  try {
    const result = await recalcularSegmentacaoCliente(id, { accountId, context });
    await registrarEventoTimelineComLog(context, {
      tipo: 'segmentacao_atualizada',
      categoria: 'segmentacao',
      titulo: 'Segmentação atualizada',
      descricao: `Cliente classificado como ${result?.segmentacao?.segmento || 'INATIVO'}`,
      referencia_id: id,
      metadata: { cliente_id: id, segmento: result?.segmentacao?.segmento || null }
    }, { accountId, clienteId: id });
    return { ok: true, repositoryMode: getClientesRepositoryMode(), ...result };
  } catch (error) {
    if (error?.code === 'OWNER_SCOPE_FORBIDDEN' || error?.code === 'VENDEDOR_SCOPE_FORBIDDEN') {
      throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    }
    throw error;
  }
}

export async function gerarAlertasClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  const result = await gerarAlertasCliente(id, { accountId, context });
  for (const alerta of Array.isArray(result?.alertas) ? result.alertas : []) {
    console.debug('[clientes.controller] registrarEventoTimeline alerta_gerado', {
      accountId,
      clienteId: id,
      alertaId: alerta?.id || null,
      tipo: alerta?.tipo || null
    });
    await registrarEventoTimelineComLog(context, {
      tipo: 'alerta_gerado',
      categoria: 'alerta',
      titulo: 'Alerta gerado',
      descricao: alerta?.titulo || 'Alerta comercial gerado.',
      referencia_id: alerta?.id || null,
      metadata: { cliente_id: id, alerta_id: alerta?.id || null, tipo_alerta: alerta?.tipo || null }
    }, { accountId, clienteId: id });
  }
  return { ok: true, repositoryMode: getClientesRepositoryMode(), ...result };
}

export async function getAlertasClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  const items = await listAlertasCliente(id, { accountId, context });
  return { ok: true, repositoryMode: getClientesRepositoryMode(), items };
}

export async function resolverAlertaClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  const body = { ...(context.body || {}) };
  const alertaId = String(body.id || context?.params?.id || '').trim();
  const status = body.status || 'resolvido';
  const item = await resolverAlertaCliente(alertaId, { accountId, context, status });
  console.debug('[clientes.controller] registrarEventoTimeline alerta_resolvido', {
    accountId,
    clienteId: item?.cliente_id || null,
    alertaId: item?.id || alertaId,
    status
  });
  await registrarEventoTimelineComLog(context, {
    tipo: status === 'resolvido' ? 'alerta_resolvido' : 'alerta_ignorado',
    categoria: 'alerta',
    titulo: status === 'resolvido' ? 'Alerta resolvido' : 'Alerta ignorado',
    descricao: status === 'resolvido' ? 'O alerta comercial foi resolvido.' : 'O alerta comercial foi ignorado.',
    referencia_id: item?.id || alertaId,
    metadata: { alerta_id: item?.id || alertaId, status }
  }, { accountId, clienteId: item?.cliente_id || null });
  return { ok: true, repositoryMode: getClientesRepositoryMode(), item };
}

export async function getTimelineClienteHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  await getClienteById(id, { accountId, context });
  const items = await listarTimelineCliente(id, { accountId, context });
  return { ok: true, repositoryMode: getClientesRepositoryMode(), items };
}
