import { randomUUID } from 'node:crypto';
import { DatabaseError, NotFoundError, ValidationError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryBatches = [];
const memoryRecords = [];
const memoryIssues = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

const batchStatuses = new Set(['pending', 'validating', 'validated', 'normalized', 'approved', 'rejected', 'imported', 'failed']);
const recordStatuses = new Set(['received', 'validated', 'normalized', 'approved', 'rejected', 'imported', 'skipped', 'invalid']);
const issueSeverities = new Set(['info', 'warning', 'error']);

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function repositoryMode() {
  const configured = resolveSupabaseConfigured();
  return { mode: configured ? 'supabase' : 'memory', supabaseConfigured: configured };
}

function assertAccountId(accountId) {
  if (!accountId) throw new ValidationError('Contexto de tenant obrigatorio', { domain: 'legacy-import-staging' });
}

function assertStatus(value, allowed, field) {
  if (!allowed.has(value)) {
    throw new ValidationError(`${field} invalido`, { domain: 'legacy-import-staging', details: { field, value } });
  }
}

function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
}

function withUpdatedAt(item) {
  return { ...item, updated_at: new Date().toISOString() };
}

function buildApprovalPatch(status, actor, reason) {
  const now = new Date().toISOString();
  if (status === 'approved') {
    return { status, approved_by: actor, approved_at: now, rejected_by: null, rejected_at: null, rejection_reason: null };
  }
  if (status === 'rejected') {
    return { status, rejected_by: actor, rejected_at: now, rejection_reason: reason || null };
  }
  return { status };
}

export function getLegacyImportStagingRepositoryMode() {
  return repositoryMode();
}

export async function createBatch(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  assertAccountId(accountId);
  assertStatus(String(payload.status || 'pending'), batchStatuses, 'status');

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const insertPayload = {
      account_id: accountId,
      source: String(payload.source || ''),
      status: String(payload.status || 'pending'),
      dry_run: payload.dry_run !== false,
      created_by: payload.created_by || null,
      summary: payload.summary || null,
      started_at: payload.started_at || null,
      finished_at: payload.finished_at || null
    };
    const { data, error } = await supabase.from('legacy_import_batches').insert(insertPayload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar batch', { details: error });
    return data;
  }

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    account_id: accountId,
    source: String(payload.source || ''),
    status: String(payload.status || 'pending'),
    dry_run: payload.dry_run !== false,
    created_by: payload.created_by || null,
    summary: payload.summary || null,
    started_at: payload.started_at || null,
    finished_at: payload.finished_at || null,
    created_at: now,
    updated_at: now
  };
  memoryBatches.push(item);
  return item;
}

export async function updateBatchStatus(batchId, status, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  assertStatus(String(status || ''), batchStatuses, 'status');

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const patch = { status: String(status) };
    if (String(status) === 'imported') patch.finished_at = new Date().toISOString();
    const { data, error } = await supabase.from('legacy_import_batches').update(patch).eq('account_id', accountId).eq('id', batchId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao atualizar batch', { details: error });
    if (!data) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const index = memoryBatches.findIndex((item) => item.id === batchId && item.account_id === accountId);
  if (index < 0) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
  memoryBatches[index] = {
    ...memoryBatches[index],
    status: String(status),
    finished_at: String(status) === 'imported' ? new Date().toISOString() : memoryBatches[index].finished_at,
    updated_at: new Date().toISOString()
  };
  return memoryBatches[index];
}

export async function approveBatch(batchId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const actor = options.actor || options.approvedBy || null;
  if (!actor) throw new ValidationError('approved_by obrigatorio', { domain: 'legacy-import-staging' });
  const updates = buildApprovalPatch('approved', actor);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_batches').update(updates).eq('account_id', accountId).eq('id', batchId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao aprovar batch', { details: error });
    if (!data) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const index = memoryBatches.findIndex((item) => item.id === batchId && item.account_id === accountId);
  if (index < 0) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
  memoryBatches[index] = withUpdatedAt({ ...memoryBatches[index], ...updates });
  memoryRecords.forEach((record, recordIndex) => {
    if (record.batch_id === batchId && record.account_id === accountId) memoryRecords[recordIndex] = withUpdatedAt({ ...record, status: 'approved' });
  });
  return memoryBatches[index];
}

export async function rejectBatch(batchId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const actor = options.actor || options.rejectedBy || null;
  if (!actor) throw new ValidationError('rejected_by obrigatorio', { domain: 'legacy-import-staging' });
  const updates = buildApprovalPatch('rejected', actor, options.reason);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_batches').update(updates).eq('account_id', accountId).eq('id', batchId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao rejeitar batch', { details: error });
    if (!data) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const index = memoryBatches.findIndex((item) => item.id === batchId && item.account_id === accountId);
  if (index < 0) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
  memoryBatches[index] = withUpdatedAt({ ...memoryBatches[index], ...updates });
  memoryRecords.forEach((record, recordIndex) => {
    if (record.batch_id === batchId && record.account_id === accountId) memoryRecords[recordIndex] = withUpdatedAt({ ...record, status: 'rejected' });
  });
  return memoryBatches[index];
}

export async function updateRecordStatus(recordId, status, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  assertStatus(String(status || ''), recordStatuses, 'status');

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_records').update({ status: String(status) }).eq('account_id', accountId).eq('id', recordId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao atualizar record', { details: error });
    if (!data) throw new NotFoundError('Record nao encontrado', { code: 'LEGACY_IMPORT_RECORD_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const index = memoryRecords.findIndex((item) => item.id === recordId && item.account_id === accountId);
  if (index < 0) throw new NotFoundError('Record nao encontrado', { code: 'LEGACY_IMPORT_RECORD_NOT_FOUND', domain: 'legacy-import-staging' });
  memoryRecords[index] = withUpdatedAt({ ...memoryRecords[index], status: String(status) });
  return memoryRecords[index];
}

export async function updateRecordFields(recordId, fields = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_records').update(fields).eq('account_id', accountId).eq('id', recordId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao atualizar record', { details: error });
    if (!data) throw new NotFoundError('Record nao encontrado', { code: 'LEGACY_IMPORT_RECORD_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const index = memoryRecords.findIndex((item) => item.id === recordId && item.account_id === accountId);
  if (index < 0) throw new NotFoundError('Record nao encontrado', { code: 'LEGACY_IMPORT_RECORD_NOT_FOUND', domain: 'legacy-import-staging' });
  memoryRecords[index] = withUpdatedAt({ ...memoryRecords[index], ...fields });
  return memoryRecords[index];
}

export async function updateBatchFields(batchId, fields = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_batches').update(fields).eq('account_id', accountId).eq('id', batchId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao atualizar batch', { details: error });
    if (!data) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const index = memoryBatches.findIndex((item) => item.id === batchId && item.account_id === accountId);
  if (index < 0) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
  memoryBatches[index] = withUpdatedAt({ ...memoryBatches[index], ...fields });
  return memoryBatches[index];
}

export async function getBatchSummary(batchId, options = {}) {
  const records = await getBatchRecords(batchId, options);
  const issues = await getBatchIssues(batchId, options);
  const summary = { total: records.length, valid: 0, invalid: 0, warnings: 0, errors: 0, status: null };
  for (const record of records) {
    if (['approved', 'validated', 'normalized'].includes(record.status)) summary.valid += 1;
    if (record.status === 'invalid') summary.invalid += 1;
  }
  for (const issue of issues) {
    if (issue.severity === 'warning') summary.warnings += 1;
    if (issue.severity === 'error') summary.errors += 1;
  }
  summary.status = records.some((record) => record.status === 'approved') ? 'approved' : records.some((record) => record.status === 'rejected') ? 'rejected' : records.some((record) => record.status === 'normalized') ? 'normalized' : records.some((record) => record.status === 'validating') ? 'validating' : null;
  return summary;
}

export async function updateBatchSummary(batchId, summary, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_batches').update({ summary }).eq('account_id', accountId).eq('id', batchId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao atualizar batch', { details: error });
    if (!data) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const index = memoryBatches.findIndex((item) => item.id === batchId && item.account_id === accountId);
  if (index < 0) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
  memoryBatches[index] = withUpdatedAt({ ...memoryBatches[index], summary });
  return memoryBatches[index];
}

export async function addRecord(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  assertAccountId(accountId);
  assertStatus(String(payload.status || ''), recordStatuses, 'status');
  if (!payload.batch_id) throw new ValidationError('batch_id obrigatorio', { domain: 'legacy-import-staging' });

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const insertPayload = {
      batch_id: payload.batch_id,
      account_id: accountId,
      entity: String(payload.entity || ''),
      legacy_id: payload.legacy_id || null,
      natural_key: payload.natural_key || null,
      status: String(payload.status),
      raw_payload: payload.raw_payload || {},
      normalized_payload: payload.normalized_payload || null,
      issues_count: Number.isFinite(payload.issues_count) ? payload.issues_count : 0,
      target_entity_id: payload.target_entity_id || null
    };
    const { data, error } = await supabase.from('legacy_import_records').insert(insertPayload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar record', { details: error });
    return data;
  }

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    batch_id: payload.batch_id,
    account_id: accountId,
    entity: String(payload.entity || ''),
    legacy_id: payload.legacy_id || null,
    natural_key: payload.natural_key || null,
    status: String(payload.status),
    raw_payload: clone(payload.raw_payload || {}),
    normalized_payload: payload.normalized_payload || null,
    issues_count: Number.isFinite(payload.issues_count) ? payload.issues_count : 0,
    target_entity_id: payload.target_entity_id || null,
    created_at: now,
    updated_at: now
  };
  memoryRecords.push(item);
  return item;
}

export async function addIssue(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  assertAccountId(accountId);
  if (!payload.batch_id) throw new ValidationError('batch_id obrigatorio', { domain: 'legacy-import-staging' });
  if (!payload.entity) throw new ValidationError('entity obrigatorio', { domain: 'legacy-import-staging' });
  if (payload.severity !== undefined) assertStatus(String(payload.severity), issueSeverities, 'severity');

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const insertPayload = {
      batch_id: payload.batch_id,
      record_id: payload.record_id || null,
      account_id: accountId,
      entity: String(payload.entity),
      field: payload.field || null,
      code: payload.code || null,
      message: payload.message || null,
      severity: payload.severity || null
    };
    const { data, error } = await supabase.from('legacy_import_issues').insert(insertPayload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar issue', { details: error });
    return data;
  }

  const item = {
    id: randomUUID(),
    batch_id: payload.batch_id,
    record_id: payload.record_id || null,
    account_id: accountId,
    entity: String(payload.entity),
    field: payload.field || null,
    code: payload.code || null,
    message: payload.message || null,
    severity: payload.severity || null,
    created_at: new Date().toISOString()
  };
  memoryIssues.push(item);
  return item;
}

export async function getBatch(batchId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_batches').select('*').eq('account_id', accountId).eq('id', batchId).maybeSingle();
    if (error) throw new DatabaseError('Falha ao obter batch', { details: error });
    if (!data) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
    return data;
  }

  const item = memoryBatches.find((batch) => batch.id === batchId && batch.account_id === accountId);
  if (!item) throw new NotFoundError('Batch nao encontrado', { code: 'LEGACY_IMPORT_BATCH_NOT_FOUND', domain: 'legacy-import-staging' });
  return item;
}

export async function getBatchRecords(batchId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_records').select('*').eq('account_id', accountId).eq('batch_id', batchId).order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar records', { details: error });
    return data || [];
  }

  return sortByCreatedAtDesc(memoryRecords.filter((record) => record.batch_id === batchId && record.account_id === accountId));
}

export async function getBatchIssues(batchId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_issues').select('*').eq('account_id', accountId).eq('batch_id', batchId).order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar issues', { details: error });
    return data || [];
  }

  return sortByCreatedAtDesc(memoryIssues.filter((issue) => issue.batch_id === batchId && issue.account_id === accountId));
}

export async function listBatches(options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (repositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('legacy_import_batches').select('*').eq('account_id', accountId).order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar batches', { details: error });
    return data || [];
  }

  return sortByCreatedAtDesc(memoryBatches.filter((batch) => batch.account_id === accountId));
}

export async function getBatchOverview(batchId, options = {}) {
  const batch = await getBatch(batchId, options);
  const records = await getBatchRecords(batchId, options);
  const issues = await getBatchIssues(batchId, options);
  const summary = await getBatchSummary(batchId, options);
  return { batch, records, issues, summary };
}

export function __setLegacyImportStagingSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}

export function __resetLegacyImportStagingMemoryForTests() {
  memoryBatches.length = 0;
  memoryRecords.length = 0;
  memoryIssues.length = 0;
  supabaseClientOverride = null;
  supabaseConfiguredOverride = null;
}
