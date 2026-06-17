import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getClientesRepositoryMode } from './clientes.repository.js';

const memoryTimeline = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function debugTimeline(action, payload) {
  if (process.env.NODE_ENV === 'production') return;
  console.debug(`[clientes.timeline] ${action}`, payload);
}

export async function registrarEventoTimeline(evento = {}, options = {}) {
  const accountId = options.accountId || null;
  const clienteId = options.clienteId || evento.cliente_id || null;
  assertAccountId(accountId);
  if (!clienteId) throw new DatabaseError('cliente_id obrigatorio para registrar timeline');

  const payload = {
    account_id: accountId,
    cliente_id: clienteId,
    tipo: normalizeText(evento.tipo),
    categoria: normalizeText(evento.categoria),
    titulo: normalizeText(evento.titulo),
    descricao: normalizeText(evento.descricao),
    referencia_id: evento.referencia_id || null,
    metadata: evento.metadata && typeof evento.metadata === 'object' ? evento.metadata : {},
    created_at: evento.created_at || new Date().toISOString()
  };

  debugTimeline('before_write', { accountId, clienteId, payload });

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('cliente_timeline').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao registrar evento na timeline', { details: error });
    debugTimeline('after_write', { accountId, clienteId, mode: 'supabase', id: data?.id || null, created_at: data?.created_at || null, categoria: data?.categoria || null, tipo: data?.tipo || null });
    return data;
  }

  const item = { id: randomUUID(), ...payload };
  memoryTimeline.push(item);
  debugTimeline('after_write', { accountId, clienteId, mode: 'memory', id: item.id, created_at: item.created_at, categoria: item.categoria, tipo: item.tipo });
  return item;
}

export async function listarTimelineCliente(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('cliente_timeline')
      .select('*')
      .eq('account_id', accountId)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar timeline do cliente', { details: error });
    return data || [];
  }
  return memoryTimeline.filter((item) => item.account_id === accountId && item.cliente_id === clienteId).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export function __resetMemoryTimelineForTests() {
  memoryTimeline.length = 0;
}
