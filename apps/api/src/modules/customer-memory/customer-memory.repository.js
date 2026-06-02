import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { buildCustomerMemory } from './customer-memory.builder.js';

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'customer-memory' });
}

const memoryStore = [];

function getMode() {
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

async function upsertMemory(accountId, clienteId, memory) {
  const payload = {
    account_id: accountId,
    cliente_id: clienteId,
    memory,
    risk_score: memory.behavior.risco === 'alto' ? 85 : memory.behavior.risco === 'medio' ? 55 : 20,
    potential_score: memory.behavior.potencial === 'alto' ? 80 : memory.behavior.potencial === 'medio' ? 55 : 25,
    last_rebuilt_at: new Date().toISOString()
  };

  if (getMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('customer_memories').upsert(payload, { onConflict: 'account_id,cliente_id' }).select('*').single();
    if (error) throw new DatabaseError('Falha ao salvar memoria do cliente', { details: error });
    return data;
  }

  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const idx = memoryStore.findIndex((row) => row.account_id === accountId && row.cliente_id === clienteId);
  if (idx >= 0) memoryStore[idx] = { ...memoryStore[idx], ...item };
  else memoryStore.push(item);
  return idx >= 0 ? memoryStore[idx] : item;
}

export async function getPersistedCustomerMemory(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (getMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('customer_memories')
      .select('*')
      .eq('account_id', accountId)
      .eq('cliente_id', clienteId)
      .maybeSingle();
    if (error) throw new DatabaseError('Falha ao ler memoria do cliente', { details: error });
    return data || null;
  }

  return memoryStore.find((row) => row.account_id === accountId && row.cliente_id === clienteId) || null;
}

export async function getCustomerMemory(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const persisted = await getPersistedCustomerMemory(clienteId, { accountId, context: options.context });
  if (persisted?.memory) return persisted.memory;
  const memory = await buildCustomerMemory(clienteId, { accountId, context: options.context });
  await upsertMemory(accountId, clienteId, memory);
  return memory;
}

export async function getCustomerMemorySummary(clienteId, options = {}) {
  const memory = await getCustomerMemory(clienteId, options);
  return {
    clienteId: memory.clienteId,
    summary: memory.summary,
    risk: memory.behavior.risco,
    potential: memory.behavior.potencial,
    diasSemCompra: memory.commercial.diasSemCompra,
    opportunities: memory.opportunities.slice(0, 3),
    alerts: memory.alerts.slice(0, 3)
  };
}

export async function rebuildCustomerMemory(clienteId, options = {}) {
  return getCustomerMemory(clienteId, options);
}

export function __resetMemoryCustomerMemoryForTests() {
  memoryStore.length = 0;
}
