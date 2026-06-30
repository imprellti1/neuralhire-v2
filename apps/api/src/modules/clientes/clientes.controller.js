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

function normalizeComparable(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => normalizeComparable(item));
  if (value && typeof value === 'object') {
    const sorted = Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = normalizeComparable(value[key]);
      return acc;
    }, {});
    return sorted;
  }
  return value;
}

function pickClienteSnapshot(cliente = {}) {
  return {
    nome: cliente.nome || null,
    razao_social: cliente.razao_social || null,
    cidade: cliente.cidade || null,
    estado: cliente.estado || null,
    status: cliente.status || null,
    vendedor_id: cliente.vendedor_id || null,
    documento: cliente.documento || null,
    telefone: cliente.telefone || null,
    email: cliente.email || null,
    cliente_score: cliente.cliente_score ?? null,
    cliente_classificacao: cliente.cliente_classificacao || null,
    cliente_potencial: cliente.cliente_potencial || null,
    cliente_score_fatores: cliente.cliente_score_fatores || {},
    enriquecimento_status: cliente.enriquecimento_status || null,
    enriquecimento_fonte: cliente.enriquecimento_fonte || null,
    enriquecimento_ultima_execucao: cliente.enriquecimento_ultima_execucao || null,
    enriquecimento_erro: cliente.enriquecimento_erro || null,
    geolocalizacao_status: cliente.geolocalizacao_status || null,
    geolocalizacao_fonte: cliente.geolocalizacao_fonte || null,
    geolocalizacao_ultima_execucao: cliente.geolocalizacao_ultima_execucao || null,
    geolocalizacao_erro: cliente.geolocalizacao_erro || null,
    latitude: cliente.latitude ?? null,
    longitude: cliente.longitude ?? null,
    google_maps_url: cliente.google_maps_url || null
  };
}

function diffClienteSnapshot(before = {}, after = {}) {
  const diff = {};
  for (const key of Object.keys({ ...before, ...after })) {
    const left = JSON.stringify(normalizeComparable(before[key]));
    const right = JSON.stringify(normalizeComparable(after[key]));
    if (left !== right) diff[key] = { before: before[key] ?? null, after: after[key] ?? null };
  }
  return diff;
}

function hasMeaningfulDiff(diff = {}) {
  return Object.keys(diff).length > 0;
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

async function registrarSincronizacaoTimeline(context, clienteId, beforeSnapshot, afterSnapshot, accountId) {
  const diff = diffClienteSnapshot(beforeSnapshot, afterSnapshot);
  const changedFields = Object.keys(diff).filter((field) => ['nome', 'razao_social', 'cidade', 'estado', 'status', 'vendedor_id', 'documento', 'telefone', 'email', 'cliente_score', 'cliente_classificacao', 'cliente_potencial', 'enriquecimento_status', 'geolocalizacao_status', 'latitude', 'longitude'].includes(field));
  if (changedFields.length) {
    await registrarEventoTimelineComLog(context, {
      tipo: 'cliente_atualizado',
      categoria: 'cadastro',
      titulo: 'Cliente atualizado',
      descricao: `Campos atualizados: ${changedFields.join(', ')}`,
      referencia_id: clienteId,
      metadata: { cliente_id: clienteId, changed_fields: changedFields, diff }
    }, { accountId, clienteId });
  }
  if (beforeSnapshot.cliente_score !== afterSnapshot.cliente_score || beforeSnapshot.cliente_classificacao !== afterSnapshot.cliente_classificacao || beforeSnapshot.cliente_potencial !== afterSnapshot.cliente_potencial) {
    await registrarEventoTimelineComLog(context, {
      tipo: 'score_atualizado',
      categoria: 'score',
      titulo: 'Score atualizado',
      descricao: `Score comercial recalculado para ${afterSnapshot.cliente_score ?? 'não calculado'}.`,
      referencia_id: clienteId,
      metadata: { cliente_id: clienteId, before: beforeSnapshot.cliente_score, after: afterSnapshot.cliente_score, classificacao: afterSnapshot.cliente_classificacao || null, potencial: afterSnapshot.cliente_potencial || null }
    }, { accountId, clienteId });
  }
  if (beforeSnapshot.enriquecimento_status !== afterSnapshot.enriquecimento_status || beforeSnapshot.enriquecimento_ultima_execucao !== afterSnapshot.enriquecimento_ultima_execucao || beforeSnapshot.enriquecimento_erro !== afterSnapshot.enriquecimento_erro) {
    await registrarEventoTimelineComLog(context, {
      tipo: afterSnapshot.enriquecimento_status === 'erro' ? 'enriquecimento_erro' : 'cliente_enriquecido',
      categoria: 'enriquecimento',
      titulo: afterSnapshot.enriquecimento_status === 'erro' ? 'Enriquecimento com erro' : 'Enriquecimento executado',
      descricao: afterSnapshot.enriquecimento_status === 'erro' ? 'A sincronização registrou um erro de enriquecimento.' : 'Os dados cadastrais foram atualizados pela sincronização.',
      referencia_id: clienteId,
      metadata: { cliente_id: clienteId, before: beforeSnapshot.enriquecimento_status || null, after: afterSnapshot.enriquecimento_status || null, erro: afterSnapshot.enriquecimento_erro || null }
    }, { accountId, clienteId });
  }
  if (beforeSnapshot.geolocalizacao_status !== afterSnapshot.geolocalizacao_status || beforeSnapshot.geolocalizacao_ultima_execucao !== afterSnapshot.geolocalizacao_ultima_execucao || beforeSnapshot.latitude !== afterSnapshot.latitude || beforeSnapshot.longitude !== afterSnapshot.longitude || beforeSnapshot.geolocalizacao_erro !== afterSnapshot.geolocalizacao_erro) {
    await registrarEventoTimelineComLog(context, {
      tipo: afterSnapshot.geolocalizacao_status === 'erro' ? 'geolocalizacao_erro' : 'cliente_geolocalizado',
      categoria: 'geolocalizacao',
      titulo: afterSnapshot.geolocalizacao_status === 'erro' ? 'Geolocalização com erro' : 'Cliente geolocalizado',
      descricao: afterSnapshot.geolocalizacao_status === 'erro' ? 'A sincronização registrou um erro de geolocalização.' : 'A geolocalização do cliente foi executada.',
      referencia_id: clienteId,
      metadata: { cliente_id: clienteId, before: beforeSnapshot.geolocalizacao_status || null, after: afterSnapshot.geolocalizacao_status || null, erro: afterSnapshot.geolocalizacao_erro || null }
    }, { accountId, clienteId });
  }
}

export async function sincronizarCliente360Handler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const id = String(context?.params?.id || '').trim();
  if (!id) throw new ValidationError('Parametro id obrigatorio', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  const summary = { score: 'skipped', enrichment: 'skipped', geolocation: 'skipped', changes: [], errors: [] };
  const current = await getClienteById(id, { accountId, context });
  const before = pickClienteSnapshot(current);
  let latest = current;

  try {
    const scoreResult = await calcularScoreComercialCliente({ accountId, clienteId: id, context });
    latest = scoreResult?.cliente || latest;
    summary.score = before.cliente_score !== latest.cliente_score ? 'updated' : 'unchanged';
  } catch (error) {
    summary.errors.push({ step: 'score', message: error?.message || 'Falha ao recalcular score' });
  }

  try {
    const canEnrich = Boolean(String(latest?.documento || '').replace(/\D/g, '').length >= 11);
    const needsEnrichment = !latest.enriquecimento_ultima_execucao || String(latest.enriquecimento_status || '').toLowerCase() === 'erro' || String(latest.enriquecimento_status || '').toLowerCase() === 'incompleto';
    if (canEnrich && needsEnrichment) {
      const enriched = await enrichClienteByCnpj(id, { accountId, context, fetchImpl: context.fetchImpl });
      latest = enriched || latest;
      summary.enrichment = 'updated';
    }
  } catch (error) {
    summary.enrichment = 'error';
    summary.errors.push({ step: 'enrichment', message: error?.message || 'Falha ao enriquecer cliente' });
  }

  try {
    const hasAddress = [latest?.logradouro, latest?.numero, latest?.bairro, latest?.cidade, latest?.estado].some((value) => String(value || '').trim());
    const needsGeolocation = hasAddress && (!latest?.geolocalizacao_ultima_execucao || String(latest?.geolocalizacao_status || '').toLowerCase() === 'erro' || !Number.isFinite(Number(latest?.latitude)) || !Number.isFinite(Number(latest?.longitude)));
    if (needsGeolocation) {
      const geo = await geolocalizarCliente({ accountId, clienteId: id, fetchImpl: context.fetchImpl, context });
      latest = geo?.cliente || latest;
      summary.geolocation = 'updated';
    }
  } catch (error) {
    summary.geolocation = 'error';
    summary.errors.push({ step: 'geolocation', message: error?.message || 'Falha ao geolocalizar cliente' });
  }

  const after = pickClienteSnapshot(latest);
  const diff = diffClienteSnapshot(before, after);
  summary.changes = Object.keys(diff);

  if (hasMeaningfulDiff(diff)) {
    await registrarSincronizacaoTimeline(context, id, before, after, accountId);
  }

  await recordAuditLog(context, {
    modulo: 'clientes',
    entidade: 'cliente',
    entidade_id: id,
    acao: 'sincronizar_360',
    descricao: 'Sincronização 360 do cliente',
    status: summary.errors.length ? 'success' : 'success',
    sucesso: true,
    metadata: { cliente_id: id, changes: summary.changes, errors: summary.errors }
  }).catch(() => null);

  return {
    ok: true,
    repositoryMode: getClientesRepositoryMode(),
    item: latest,
    resumo: summary
  };
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
