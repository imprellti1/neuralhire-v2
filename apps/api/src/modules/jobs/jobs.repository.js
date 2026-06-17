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
    status: 'idle',
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

export function getSystemJobDefaults() {
  return [
    { nome: 'radar_comercial_diario', lock_key: 'jobs:radar_comercial_diario', metadata: { cadence: 'daily-0300', ttlMinutes: 120 } },
    { nome: 'clientes_enriquecimento_geolocalizacao', lock_key: 'jobs:clientes_enriquecimento_geolocalizacao', metadata: { cadence: 'adaptive', ttlMinutes: 20 } },
    { nome: 'clientes_resumo_semanal', lock_key: 'jobs:clientes_resumo_semanal', metadata: { cadence: 'weekly-monday-0800', ttlMinutes: 30 } },
    { nome: 'notificacoes_resumo_semanal', lock_key: 'notificacoes:resumo-semanal', metadata: { cadence: 'weekly-monday-0800', ttlMinutes: 30 } }
  ];
}

function seedSystemJobs(accountId = null) {
  for (const job of getSystemJobDefaults()) {
    const key = `${accountId || 'global'}:${job.lock_key}`;
    if (!memoryJobs.has(key)) memoryJobs.set(key, defaultJob(job.nome, key, accountId, job.metadata));
  }
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
  assertAccountId(accountId);
  const jobNome = nome;
  const jobLockKey = lockKey || `${accountId || 'global'}:${jobNome}`;
  const baseJob = defaultJob(jobNome, jobLockKey, accountId, metadata);
  const payload = {
    ...baseJob,
    nome: jobNome,
    lock_key: jobLockKey,
    account_id: accountId,
    metadata: { ...baseJob.metadata, ...metadata },
    updated_at: nowIso()
  };

  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');

    const { data, error } = await supabase
      .from('system_jobs')
      .upsert(payload, { onConflict: 'lock_key' })
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
  return data || [];
}

export async function listSystemJobs(accountId = null) {
  if (resolveSupabaseConfigured()) return listJobsSupabase(accountId);
  seedSystemJobs(accountId);
  return [...memoryJobs.values()].filter((job) => job.account_id === accountId || (!accountId && job.account_id === null));
}

export async function upsertSystemJob(job, options = {}) {
  const accountId = options.accountId ?? job.account_id ?? null;
  const lockKey = job.lock_key || `${accountId || 'global'}:${job.nome}`;
  const payload = { ...job, account_id: accountId, lock_key: lockKey, updated_at: nowIso() };
  if (resolveSupabaseConfigured()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('system_jobs').upsert(payload, { onConflict: 'lock_key' }).select('*').single();
    if (error) throw new DatabaseError('Falha ao persistir job', { details: error });
    return data;
  }
  const current = resolveMemoryJob(lockKey) || defaultJob(job.nome, lockKey, accountId, job.metadata);
  const next = { ...current, ...payload };
  memoryJobs.set(lockKey, next);
  return next;
}

export async function recordSystemJobRun(payload, options = {}) {
  const accountId = options.accountId ?? payload.account_id ?? null;
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
    if (options.startedAfter) query = query.gte('started_at', options.startedAfter);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar execucoes de jobs', { details: error });
    return data || [];
  }
  return memoryRuns
    .filter((run) => (!accountId || run.account_id === accountId) && (!options.nome || run.nome === options.nome) && (!options.startedAfter || new Date(run.started_at).getTime() >= new Date(options.startedAfter).getTime()))
    .map((item) => ({ ...item }));
}

export async function acquireSystemJobLock({ lockKey, nome, ttlMinutes, accountId, workerId }) {
  assertAccountId(accountId);
  if (resolveSupabaseConfigured()) {
    const ttlMs = Math.max(1, Number(ttlMinutes) || 30) * 60000;
    const job = await ensureSystemJob({ lockKey, nome, accountId, metadata: { ttlMinutes }, requestId: workerId });
    const lockedAt = job?.locked_at ? new Date(job.locked_at) : null;
    const isRunning = String(job?.status || '').toLowerCase() === 'running';
    const lockValid = lockedAt && (Date.now() - lockedAt.getTime()) < ttlMs;
    if (isRunning && lockValid) return { acquired: false, job };
    const next = await upsertSystemJob({ ...job, status: 'running', locked_at: nowIso(), locked_by: workerId || 'local', last_run_at: nowIso() }, { accountId });
    return { acquired: true, job: next };
  }
  seedSystemJobs(accountId);
  const current = resolveMemoryJob(lockKey) || defaultJob(nome, lockKey, accountId);
  const ttlMs = Math.max(1, Number(ttlMinutes) || 30) * 60000;
  const lockedAt = current.locked_at ? new Date(current.locked_at) : null;
  const lockValid = current.status === 'running' && lockedAt && (Date.now() - lockedAt.getTime()) < ttlMs;
  if (lockValid) return { acquired: false, job: current };
  const next = { ...current, status: 'running', locked_at: nowIso(), locked_by: workerId || 'local', last_run_at: nowIso(), updated_at: nowIso() };
  memoryJobs.set(lockKey, next);
  return { acquired: true, job: next };
}

export async function releaseSystemJobLock(lockKey, updates = {}) {
  if (resolveSupabaseConfigured()) {
    const current = await getSystemJobByLockKey(lockKey);
    if (!current) return null;
    return upsertSystemJob({ ...current, ...updates, status: updates.status || current.status || 'idle' }, { accountId: current.account_id });
  }
  const job = resolveMemoryJob(lockKey);
  if (!job) return null;
  const next = { ...job, ...updates, status: updates.status || job.status || 'idle', updated_at: nowIso() };
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
