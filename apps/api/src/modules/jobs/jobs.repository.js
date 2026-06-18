import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryJobs = new Map();
const memoryRuns = [];
const memoryLogs = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

function nowIso() {
  return new Date().toISOString();
}

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'system-jobs' });
}

function defaultJob(nome, lockKey, accountId = null, metadata = {}) {
  return {
    id: randomUUID(),
    account_id: accountId,
    nome,
    status: 'ativo',
    lock_key: lockKey,
    locked_at: null,
    locked_by: null,
    last_run_at: null,
    next_run_at: null,
    last_success_at: null,
    last_error: null,
    metadata: { ...metadata },
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

function normalizeSystemJobStatus(status) {
  const value = String(status || '').toLowerCase();
  return value === 'inativo' ? 'inativo' : 'ativo';
}

function canonicalJobLockKey(nome) {
  return getSystemJobDefaults().find((job) => job.nome === nome)?.lock_key || nome;
}

export function getSystemJobDefaults() {
  return [
    { nome: 'radar_comercial_diario', lock_key: 'jobs:radar_comercial_diario', metadata: { cadence: 'daily-0300', ttlMinutes: 120 } },
    { nome: 'clientes_enriquecimento_automatico', lock_key: 'clientes:enriquecimento:automatico', metadata: { cadence: 'adaptive', ttlMinutes: 30 } },
    { nome: 'clientes_geolocalizacao_automatico', lock_key: 'clientes:geolocalizacao:automatico', metadata: { cadence: 'adaptive', ttlMinutes: 30 } },
    { nome: 'notificacoes_resumo_semanal', lock_key: 'notificacoes:resumo-semanal', metadata: { cadence: 'weekly-monday-0800', ttlMinutes: 30 } },
    { nome: 'gerente_comercial_observacao', lock_key: 'gerente_comercial_observacao', metadata: { cadence: 'daily-0400', ttlMinutes: 60 } },
    { nome: 'gerente_produtos_observacao', lock_key: 'gerente_produtos_observacao', metadata: { cadence: 'daily-0415', ttlMinutes: 60 } },
    { nome: 'gerente_auditoria_observacao', lock_key: 'gerente_auditoria_observacao', metadata: { cadence: 'daily-0430', ttlMinutes: 60 } },
    { nome: 'gerente_administrativo_observacao', lock_key: 'gerente_administrativo_observacao', metadata: { cadence: 'daily-0445', ttlMinutes: 60 } },
    { nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', metadata: { cadence: 'daily-0500', ttlMinutes: 60 } },
    { nome: 'diretor_plano_acao', lock_key: 'diretor_plano_acao', metadata: { cadence: 'daily-0530', ttlMinutes: 60 } },
    { nome: 'diretor_delegacao', lock_key: 'diretor_delegacao', metadata: { cadence: 'daily-0430', ttlMinutes: 60 } }
  ];
}

function seedSystemJobs(accountId = null) {
  for (const job of getSystemJobDefaults()) {
    const key = job.lock_key;
    if (!memoryJobs.has(key)) memoryJobs.set(key, defaultJob(job.nome, key, accountId, job.metadata));
  }
}

export async function ensureDefaultSystemJobs(accountId = null, { logger: bootstrapLogger = null } = {}) {
  const defaults = getSystemJobDefaults();
  bootstrapLogger?.info?.('system_jobs_bootstrap_started', {
    account_id: accountId || null,
    count: defaults.length,
    jobs: defaults.map((job) => ({ nome: job.nome, lock_key: job.lock_key }))
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const job of defaults) {
    const before = await getSystemJobByLockKey(job.lock_key);
    const result = await upsertSystemJob({
      nome: job.nome,
      lock_key: job.lock_key,
      account_id: null,
      status: 'ativo',
      metadata: job.metadata
    }, { accountId: null });
    if (!before) created += 1;
    else if (result?.updated_at && before?.updated_at && result.updated_at !== before.updated_at) updated += 1;
    else skipped += 1;
  }

  bootstrapLogger?.info?.('system_jobs_bootstrap_finished', {
    account_id: accountId || null,
    created,
    updated,
    skipped,
    total: defaults.length
  });

  return { ok: true, created, updated, skipped, total: defaults.length };
}

function resolveMemoryJob(lockKey) {
  return memoryJobs.get(lockKey) || null;
}

function logSystemJobSupabaseError(stage, { requestId = null, accountId = null, nome = null, lockKey = null, payload = null, error = null } = {}) {
  console.error('[jobs.repository] system_job_error', {
    stage,
    requestId,
    account_id: accountId,
    nome,
    lock_key: lockKey,
    payload,
    error: {
      message: error?.message || null,
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null
    }
  });
}

async function ensureSystemJob({ lockKey, nome, accountId = null, metadata = {}, requestId = null }) {
  const jobNome = nome;
  const jobLockKey = lockKey || canonicalJobLockKey(jobNome);
  const timestamp = nowIso();
  const payload = {
    id: randomUUID(),
    account_id: accountId,
    nome: jobNome,
    status: 'ativo',
    lock_key: jobLockKey,
    locked_at: null,
    locked_by: null,
    last_run_at: null,
    next_run_at: null,
    last_success_at: null,
    last_error: null,
    metadata: { ...metadata },
    created_at: timestamp,
    updated_at: timestamp
  };

  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');

    const { data: current, error: currentError } = await supabase
      .from('system_jobs')
      .select('*')
      .eq('lock_key', jobLockKey)
      .maybeSingle();

    if (currentError) {
      logSystemJobSupabaseError('ensureSystemJob.select', { requestId, accountId, nome: jobNome, lockKey: jobLockKey, payload, error: currentError });
      throw new DatabaseError('Falha ao persistir job', { details: currentError });
    }

    if (current) {
      const updatePayload = {
        nome: jobNome,
        status: normalizeSystemJobStatus(current.status || 'ativo'),
        metadata: { ...(current.metadata || {}), ...metadata },
        updated_at: timestamp
      };

      const { data, error } = await supabase
        .from('system_jobs')
        .update(updatePayload)
        .eq('lock_key', jobLockKey)
        .select('*')
        .single();

      if (error) {
        logSystemJobSupabaseError('ensureSystemJob.update', { requestId, accountId, nome: jobNome, lockKey: jobLockKey, payload: updatePayload, error });
        throw new DatabaseError('Falha ao persistir job', { details: error });
      }
      return data;
    }

    const { data, error } = await supabase
      .from('system_jobs')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      logSystemJobSupabaseError('ensureSystemJob', { requestId, accountId, nome: jobNome, lockKey: jobLockKey, payload, error });
      throw new DatabaseError('Falha ao persistir job', { details: error });
    }
    return data;
  }

  const current = [...memoryJobs.values()].find((job) => job.nome === jobNome && String(job.account_id ?? null) === String(accountId ?? null)) || null;
  const next = current ? { ...current, ...payload, id: current.id } : payload;
  memoryJobs.set(jobLockKey, next);
  return next;
}

async function listJobsSupabase(accountId = null) {
  const supabase = resolveSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  let query = supabase.from('system_jobs').select('*').order('created_at', { ascending: true });
  if (accountId) query = query.or(`account_id.is.null,account_id.eq.${accountId}`);
  const { data, error } = await query;
  if (error) throw new DatabaseError('Falha ao listar jobs', { details: error });
  return [...new Map((data || []).map((job) => [job.lock_key, job])).values()];
}

export async function listSystemJobs(accountId = null, options = {}) {
  if (resolveSupabaseConfigured()) return listJobsSupabase(accountId);
  seedSystemJobs(accountId);
  const items = [...memoryJobs.values()].filter((job) => job.account_id === accountId || (!accountId && job.account_id === null));
  const deduped = [...new Map(items.map((job) => [job.lock_key, job])).values()];
  return deduped.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
}

export async function listDueSystemJobs({ now = new Date(), limit = 10, accountId = null } = {}) {
  const nowIsoValue = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase
      .from('system_jobs')
      .select('*')
      .eq('status', 'ativo')
      .not('next_run_at', 'is', null)
      .lte('next_run_at', nowIsoValue)
      .order('next_run_at', { ascending: true })
      .limit(Math.max(1, Number(limit) || 10));
    if (accountId) query = query.or(`account_id.is.null,account_id.eq.${accountId}`);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar jobs vencidos', { details: error });
    return data || [];
  }
  seedSystemJobs(accountId);
  return [...memoryJobs.values()]
    .filter((job) =>
      (accountId ? job.account_id === accountId || job.account_id === null : true) &&
      String(job.status || '').toLowerCase() === 'ativo' &&
      job.next_run_at &&
      new Date(job.next_run_at).getTime() <= new Date(nowIsoValue).getTime())
    .sort((a, b) => new Date(a.next_run_at || 0).getTime() - new Date(b.next_run_at || 0).getTime())
    .slice(0, Math.max(1, Number(limit) || 10))
    .map((item) => ({ ...item }));
}

export async function upsertSystemJob(job, options = {}) {
  const accountId = options.accountId ?? job.account_id ?? null;
  const lockKey = job.lock_key || canonicalJobLockKey(job.nome);
  const timestamp = nowIso();
  const payload = {
    id: job.id || randomUUID(),
    account_id: accountId,
    nome: job.nome,
    status: normalizeSystemJobStatus(job.status),
    lock_key: lockKey,
    locked_at: job.locked_at ?? null,
    locked_by: job.locked_by ?? null,
    last_run_at: job.last_run_at ?? null,
    next_run_at: job.next_run_at ?? null,
    last_success_at: job.last_success_at ?? null,
    last_error: job.last_error ?? null,
    metadata: { ...(job.metadata || {}) },
    created_at: job.created_at || timestamp,
    updated_at: timestamp
  };
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: current, error: currentError } = await supabase.from('system_jobs').select('*').eq('lock_key', lockKey).maybeSingle();
    if (currentError) throw new DatabaseError('Falha ao persistir job', { details: currentError });
    if (current) {
      const updatePayload = {
        nome: job.nome,
        status: normalizeSystemJobStatus(current.status || job.status || 'ativo'),
        metadata: { ...(current.metadata || {}), ...(job.metadata || {}) },
        updated_at: timestamp
      };
      const { data, error } = await supabase.from('system_jobs').update(updatePayload).eq('lock_key', lockKey).select('*').single();
      if (error) throw new DatabaseError('Falha ao persistir job', { details: error });
      return data;
    }
    const { data, error } = await supabase.from('system_jobs').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao persistir job', { details: error });
    return data;
  }
  const current = resolveMemoryJob(lockKey) || defaultJob(job.nome, lockKey, accountId, job.metadata);
  const next = { ...current, ...payload, status: normalizeSystemJobStatus(payload.status) };
  memoryJobs.set(lockKey, next);
  return next;
}

export async function updateSystemJobSchedule(identifier, updates = {}, options = {}) {
  const accountId = options.accountId ?? null;
  const timestamp = nowIso();
  const safeUpdates = {
    ...updates,
    updated_at: timestamp
  };

  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');

    let query = supabase.from('system_jobs').update(safeUpdates).select('*');
    if (identifier?.id) {
      query = query.eq('id', identifier.id);
    } else if (identifier?.jobKey) {
      query = query.eq('lock_key', canonicalJobLockKey(identifier.jobKey));
    } else if (identifier?.lockKey) {
      query = query.eq('lock_key', canonicalJobLockKey(identifier.lockKey));
    } else {
      throw new DatabaseError('Identificador de job ausente');
    }
    if (accountId) query = query.or(`account_id.is.null,account_id.eq.${accountId}`);

    const { data, error } = await query.single();
    if (error) throw new DatabaseError('Falha ao atualizar job', { details: error });
    return data;
  }

  const target = identifier?.id
    ? [...memoryJobs.values()].find((job) => String(job.id) === String(identifier.id)) || null
    : identifier?.jobKey
      ? [...memoryJobs.values()].find((job) => job.lock_key === canonicalJobLockKey(identifier.jobKey) || job.nome === identifier.jobKey) || null
      : identifier?.lockKey
        ? resolveMemoryJob(canonicalJobLockKey(identifier.lockKey))
        : null;
  if (!target) throw new DatabaseError('Job nao encontrado para atualizar');
  const next = { ...target, ...safeUpdates };
  memoryJobs.set(next.lock_key, next);
  return next;
}

export async function recordSystemJobRun(payload, options = {}) {
  const accountId = options.accountId ?? payload.account_id ?? null;
  const jobId = payload.job_id || options.jobId || null;
  if (!jobId) {
    const fallbackJob = payload.nome ? await getSystemJobByLockKey(canonicalJobLockKey(payload.nome)).catch(() => null) : null;
    if (!fallbackJob?.id) throw new DatabaseError('Job id obrigatorio para registrar execucao');
    payload.job_id = fallbackJob.id;
  } else {
    payload.job_id = jobId;
  }
  const run = {
    id: randomUUID(),
    job_id: payload.job_id,
    account_id: accountId,
    nome: payload.nome,
    status: payload.status,
    started_at: payload.started_at || nowIso(),
    finished_at: payload.finished_at || null,
    duration_ms: payload.duration_ms ?? null,
    processed_count: payload.processed_count ?? 0,
    success_count: payload.success_count ?? 0,
    error_count: payload.error_count ?? 0,
    metadata: payload.metadata || {},
    error: payload.error || null
  };
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('system_job_runs').insert(run).select('*').single();
    if (error) throw new DatabaseError('Falha ao registrar execucao do job', { details: error });
    return data;
  }
  memoryRuns.push(run);
  return run;
}

export async function listSystemJobRuns(accountId = null, options = {}) {
  const supabase = resolveSupabaseClient();
  if (resolveSupabaseConfigured()) {
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('system_job_runs').select('*').order('started_at', { ascending: false });
    if (accountId) query = query.eq('account_id', accountId);
    if (options.nome) query = query.eq('nome', options.nome);
    if (options.status) query = query.eq('status', options.status);
    if (options.jobId) query = query.eq('job_id', options.jobId);
    if (options.startedAfter) query = query.gte('started_at', options.startedAfter);
    if (options.limit) query = query.limit(Number(options.limit));
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar execucoes de jobs', { details: error });
    return data || [];
  }
  return memoryRuns
    .filter((run) =>
      (!accountId || run.account_id === accountId) &&
      (!options.nome || run.nome === options.nome) &&
      (!options.status || run.status === options.status) &&
      (!options.jobId || run.job_id === options.jobId) &&
      (!options.startedAfter || new Date(run.started_at).getTime() >= new Date(options.startedAfter).getTime()))
    .sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())
    .slice(0, options.limit ? Number(options.limit) : undefined)
    .map((item) => ({ ...item }));
}

export async function getSystemJobById(jobId, accountId = null) {
  const jobs = await listSystemJobs(accountId);
  return jobs.find((job) => String(job.id) === String(jobId)) || null;
}

export async function listSystemJobRunsForJob(jobId, accountId = null, options = {}) {
  return listSystemJobRuns(accountId, { ...options, jobId });
}

export async function acquireSystemJobLock({ lockKey, nome, ttlMinutes, accountId, workerId }) {
  if (resolveSupabaseConfigured()) {
    const ttlMs = Math.max(1, Number(ttlMinutes) || 30) * 60000;
    const job = await ensureSystemJob({ lockKey, nome, accountId, metadata: { ttlMinutes }, requestId: workerId });
    const lockedAt = job?.locked_at ? new Date(job.locked_at) : null;
    const isRunning = Boolean(job?.locked_at);
    const lockValid = lockedAt && (Date.now() - lockedAt.getTime()) < ttlMs;
    if (isRunning && lockValid) return { acquired: false, job };
    const next = await upsertSystemJob({ ...job, status: 'ativo', locked_at: nowIso(), locked_by: workerId || 'local', last_run_at: nowIso() }, { accountId });
    return { acquired: true, job: next };
  }
  seedSystemJobs(accountId);
  const current = resolveMemoryJob(lockKey) || defaultJob(nome, lockKey, accountId);
  const ttlMs = Math.max(1, Number(ttlMinutes) || 30) * 60000;
  const lockedAt = current.locked_at ? new Date(current.locked_at) : null;
  const lockValid = Boolean(current.locked_at) && lockedAt && (Date.now() - lockedAt.getTime()) < ttlMs;
  if (lockValid) return { acquired: false, job: current };
  const next = { ...current, status: 'ativo', locked_at: nowIso(), locked_by: workerId || 'local', last_run_at: nowIso(), updated_at: nowIso() };
  memoryJobs.set(lockKey, next);
  return { acquired: true, job: next };
}

export async function releaseSystemJobLock(lockKey, updates = {}) {
  if (resolveSupabaseConfigured()) {
    const current = await getSystemJobByLockKey(lockKey);
    if (!current) return null;
    const { status, ...safeUpdates } = updates || {};
    return upsertSystemJob({ ...current, ...safeUpdates, status: current.status || 'ativo' }, { accountId: current.account_id });
  }
  const job = resolveMemoryJob(lockKey);
  if (!job) return null;
  const { status, ...safeUpdates } = updates || {};
  const next = { ...job, ...safeUpdates, status: job.status || 'ativo', updated_at: nowIso() };
  memoryJobs.set(lockKey, next);
  return next;
}

export async function getSystemJobByLockKey(lockKey) {
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('system_jobs').select('*').eq('lock_key', lockKey).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar job', { details: error });
    return data || null;
  }
  return resolveMemoryJob(lockKey);
}

export async function recordClienteAutomacaoLog(payload, options = {}) {
  const accountId = options.accountId ?? payload.account_id ?? null;
  assertAccountId(accountId);
  const log = { id: randomUUID(), account_id: accountId, cliente_id: payload.cliente_id, tipo: payload.tipo, status: payload.status, detalhe: payload.detalhe || null, metadata: payload.metadata || {}, created_at: nowIso() };
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { error } = await supabase.from('cliente_automacao_logs').insert(log);
    if (error) throw new DatabaseError('Falha ao registrar log do cliente', { details: error });
    return log;
  }
  memoryLogs.push(log);
  return log;
}

export function listSystemJobLogs(accountId = null) {
  return memoryLogs.filter((item) => !accountId || item.account_id === accountId).map((item) => ({ ...item }));
}

export function __resetSystemJobsForTests() {
  memoryJobs.clear();
  memoryRuns.length = 0;
  memoryLogs.length = 0;
}

export function __dumpSystemJobsForTests() {
  return {
    jobs: [...memoryJobs.values()].map((item) => ({ ...item })),
    runs: memoryRuns.map((item) => ({ ...item })),
    logs: memoryLogs.map((item) => ({ ...item }))
  };
}

export function __setSystemJobsSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}
