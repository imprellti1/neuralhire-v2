import { randomUUID } from 'node:crypto';
import { ConflictError, DatabaseError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { assertTenantContext, getAccountIdFromContext } from '../../core/tenant-context.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memory = [];
const memoryEvents = [];
const memoryTemplates = [];
const memoryLogs = [];
const memoryAccounts = [];
const memoryAccountUsers = [];
const memoryAccountTrials = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

export function getInterestLeadsRepositoryMode() {
  const configured = resolveSupabaseConfigured();
  return { mode: configured ? 'supabase' : 'memory', supabaseConfigured: configured };
}

function applyFilters(items, f) {
  let out = [...items];
  if (f.search) {
    const q = f.search.toLowerCase();
    out = out.filter((x) => [x.nome, x.empresa, x.whatsapp, x.email].some((v) => String(v || '').toLowerCase().includes(q)));
  }
  if (f.status) out = out.filter((x) => x.status === f.status);
  if (f.cidade) out = out.filter((x) => String(x.cidade || '').toLowerCase().includes(f.cidade.toLowerCase()));
  if (f.segmento) out = out.filter((x) => String(x.segmento || '').toLowerCase().includes(f.segmento.toLowerCase())); if (f.inviteStatus) out = out.filter((x)=>x.invite_status===f.inviteStatus); if (f.launchBatch) out = out.filter((x)=>String(x.launch_batch||'')===f.launchBatch); if (f.uf) out = out.filter((x)=>String(x.estado||x.uf||'').toUpperCase()===f.uf);
  return out;
}

function mapDbLead(row = {}) {
  return {
    ...row,
    estado: row.uf ?? row.estado ?? '',
    quantidade_vendedores: row.quantidade_vendedores ?? 0
  };
}

function toDbLead(payload = {}) {
  return {
    nome: payload.nome,
    empresa: payload.empresa || null,
    email: payload.email || null,
    whatsapp: payload.whatsapp || null,
    cidade: payload.cidade || null,
    uf: payload.estado || payload.uf || null,
    origem: payload.origem || null,
    status: payload.status || 'novo',
    observacoes: payload.observacoes || null,
    responsavel: payload.responsavel || null,
    ultimo_contato_em: payload.ultimo_contato_em || null
  };
}

function resolveAccountId(options = {}) {
  const accountId = options.accountId || getAccountIdFromContext(options.context);
  return accountId || null;
}

async function addEvent(lead, tipo, descricao = '') {
  if (getInterestLeadsRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { error } = await supabase.from('interest_lead_events').insert({
      account_id: lead.account_id,
      lead_id: lead.id,
      tipo,
      descricao: String(descricao || '')
    });
    if (error) throw new DatabaseError('Falha ao criar evento', { details: error });
    return;
  }
  memoryEvents.push({ id: randomUUID(), lead_id: lead.id, tipo, descricao: String(descricao || ''), created_at: new Date().toISOString() });
}

export async function createInterestLead(payload, options = {}) {
  if (getInterestLeadsRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const accountId = resolveAccountId(options);
    assertTenantContext({ auth: { accountId } }, { domain: 'pre-lancamento-interest-leads' });
    const dbPayload = { ...toDbLead(payload), account_id: accountId };
    const { data, error } = await supabase.from('interest_leads').insert(dbPayload).select('*').single();
    if (error) {
      logger.error('[interest-leads:supabase-insert] failed', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      throw new DatabaseError('Falha ao criar interest lead', { details: error });
    }
    const item = mapDbLead(data);
    await addEvent(item, 'lead_criado', 'Lead criado');
    return item;
  }
  const now = new Date().toISOString();
  const accountId = resolveAccountId(options) || 'pre-lancamento';
  const item = { id: randomUUID(), ...payload, created_at: now, updated_at: now, account_id: accountId };
  memory.push(item);
  await addEvent(item, 'lead_criado', 'Lead criado');
  return item;
}

export async function listInterestLeads(filters, options = {}) {
  if (getInterestLeadsRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const accountId = resolveAccountId(options);
    assertTenantContext({ auth: { accountId } }, { domain: 'pre-lancamento-interest-leads' });
    let query = supabase.from('interest_leads').select('*', { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false });
    if (filters.search) query = query.or(`nome.ilike.%${filters.search}%,empresa.ilike.%${filters.search}%,whatsapp.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.cidade) query = query.ilike('cidade', `%${filters.cidade}%`);
    if (filters.segmento) query = query.ilike('segmento', `%${filters.segmento}%`);
    const from = (filters.page - 1) * filters.limit;
    const { data, error, count } = await query.range(from, from + filters.limit - 1);
    if (error) throw new DatabaseError('Falha ao listar interest leads', { details: error });
    return { items: (data || []).map(mapDbLead), total: count || 0 };
  }
  const filtered = applyFilters(memory, filters).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const from = (filters.page - 1) * filters.limit;
  return { items: filtered.slice(from, from + filters.limit), total: filtered.length };
}

export async function getInterestLeadById(id, options = {}) {
  if (getInterestLeadsRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const accountId = resolveAccountId(options);
    assertTenantContext({ auth: { accountId } }, { domain: 'pre-lancamento-interest-leads' });
    const { data, error } = await supabase.from('interest_leads').select('*').eq('account_id', accountId).eq('id', id).maybeSingle();
    if (error) throw new DatabaseError('Falha ao obter lead', { details: error });
    if (!data) throw new NotFoundError('Interest lead nao encontrado');
    return mapDbLead(data);
  }
  const item = memory.find((x) => x.id === id);
  if (!item) throw new NotFoundError('Interest lead nao encontrado');
  return item;
}

export async function patchInterestLead(id, patch, options = {}) {
  const current = await getInterestLeadById(id, options);
  if (getInterestLeadsRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const dbPatch = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.responsavel !== undefined) dbPatch.responsavel = patch.responsavel;
    if (patch.observacoes !== undefined) dbPatch.observacoes = patch.observacoes;
    if (patch.ultimo_contato_em !== undefined) dbPatch.ultimo_contato_em = patch.ultimo_contato_em; if (patch.invite_status !== undefined) dbPatch.invite_status = patch.invite_status; if (patch.launch_batch !== undefined) dbPatch.launch_batch = patch.launch_batch; if (patch.invite_sent_at !== undefined) dbPatch.invite_sent_at = patch.invite_sent_at; if (patch.invite_opened_at !== undefined) dbPatch.invite_opened_at = patch.invite_opened_at; if (patch.invite_response_at !== undefined) dbPatch.invite_response_at = patch.invite_response_at; if (patch.converted_account_id !== undefined) dbPatch.converted_account_id = patch.converted_account_id; if (patch.converted_at !== undefined) dbPatch.converted_at = patch.converted_at;
    const accountId = resolveAccountId(options);
    assertTenantContext({ auth: { accountId } }, { domain: 'pre-lancamento-interest-leads' });
    const { data, error } = await supabase.from('interest_leads').update(dbPatch).eq('account_id', accountId).eq('id', id).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao atualizar lead', { details: error });
    if (!data) throw new NotFoundError('Interest lead nao encontrado');
    const item = mapDbLead(data);
    if (patch.status && patch.status !== current.status) await addEvent(item, 'status_alterado', `Status: ${current.status} -> ${patch.status}`);
    if (patch.observacoes) await addEvent(item, 'observacao_adicionada', patch.observacoes);
    return item;
  }
  const i = memory.findIndex((x) => x.id === id);
  memory[i] = { ...memory[i], ...patch, updated_at: new Date().toISOString() };
  if (patch.status && patch.status !== current.status) await addEvent(memory[i], 'status_alterado', `Status: ${current.status} -> ${patch.status}`);
  if (patch.observacoes) await addEvent(memory[i], 'observacao_adicionada', patch.observacoes);
  return memory[i];
}

export async function updateInterestLeadStatus(id, status, options = {}) { return patchInterestLead(id, { status }, options); }

export async function listInterestLeadsForExport(filters) {
  const list = await listInterestLeads({ ...filters, page: 1, limit: 10000 });
  return list.items;
}

export async function getInterestLeadEvents(id, options = {}) {
  if (getInterestLeadsRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const accountId = resolveAccountId(options);
    assertTenantContext({ auth: { accountId } }, { domain: 'pre-lancamento-interest-leads' });
    const { data, error } = await supabase.from('interest_lead_events').select('*').eq('account_id', accountId).eq('lead_id', id).order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar eventos', { details: error });
    return data || [];
  }
  return memoryEvents.filter((x) => x.lead_id === id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function createInterestLeadEvent(id, payload, options = {}) {
  const lead = await getInterestLeadById(id, options);
  await addEvent(lead, payload.tipo, payload.descricao || '');
  const events = await getInterestLeadEvents(id, options);
  return events[0];
}

export async function getInterestLeadsDashboard() {
  const items = (await listInterestLeads({ page: 1, limit: 10000, search: '', status: '', cidade: '', segmento: '' })).items;
  const now = Date.now();
  const dayMs = 86400000;
  const porStatus = {};
  const porEstado = {};
  const porCidade = {};
  items.forEach((x) => {
    porStatus[x.status] = (porStatus[x.status] || 0) + 1;
    porEstado[x.estado || ''] = (porEstado[x.estado || ''] || 0) + 1;
    porCidade[x.cidade || ''] = (porCidade[x.cidade || ''] || 0) + 1;
  });
  const crescimento7Dias = items.filter((x) => now - new Date(x.created_at).getTime() <= 7 * dayMs).length;
  const crescimento30Dias = items.filter((x) => now - new Date(x.created_at).getTime() <= 30 * dayMs).length;
  const hoje = new Date().toISOString().slice(0, 10);
  const novosHoje = items.filter((x) => String(x.created_at || '').slice(0, 10) === hoje).length;
  return { totalLeads: items.length, novosHoje, porStatus, porEstado, porCidade, ultimosCadastros: [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 10), crescimento7Dias, crescimento30Dias };
}

export function __setInterestLeadsSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}

export function __resetMemoryInterestLeadsForTests() {
  memory.length = 0;
  memoryEvents.length = 0;
  memoryTemplates.length = 0;
  memoryLogs.length = 0;
  supabaseClientOverride = null;
  supabaseConfiguredOverride = null;
}

export async function patchInterestLeadInvite(id, payload, options = {}) {
  const patch = {};
  if (payload.inviteStatus !== undefined) patch.invite_status = payload.inviteStatus;
  if (payload.launchBatch !== undefined) patch.launch_batch = payload.launchBatch;
  if (payload.inviteStatus === 'enviado') patch.invite_sent_at = new Date().toISOString();
  if (payload.inviteStatus === 'aberto') patch.invite_opened_at = new Date().toISOString();
  if (payload.inviteStatus === 'respondeu') patch.invite_response_at = new Date().toISOString();
  const current = await getInterestLeadById(id, options);
  const updated = await patchInterestLead(id, patch, options);
  if (payload.inviteStatus !== undefined && payload.inviteStatus !== current.invite_status) {
    await addEvent(updated, 'invite_status_alterado', `Invite: ${current.invite_status || '-'} -> ${payload.inviteStatus || '-'}`);
  }
  if (payload.launchBatch !== undefined && payload.launchBatch !== current.launch_batch) {
    await addEvent(updated, 'launch_batch_alterado', `Lote: ${current.launch_batch || '-'} -> ${payload.launchBatch || '-'}`);
  }
  return updated;
}
export async function bulkSetLaunchBatch(leadIds=[],launchBatch){ const out=[]; for(const id of leadIds){ out.push(await patchInterestLeadInvite(id,{ launchBatch })); } return out; }
export async function getInterestLeadsLaunchDashboard(){ const items=(await listInterestLeads({page:1,limit:10000,search:'',status:'',cidade:'',segmento:'',inviteStatus:'',launchBatch:'',uf:''})).items; const by=(s)=>items.filter((x)=>(x.invite_status||'nao_convidado')===s).length; const porLote={ 'lote-1':0,'lote-2':0,'lote-3':0 }; items.forEach((x)=>{ if(x.launch_batch && porLote[x.launch_batch]!==undefined) porLote[x.launch_batch]+=1; }); return { totalInteressados:items.length, naoConvidados:by('nao_convidado'), agendados:by('agendado'), enviados:by('enviado')+by('aberto'), responderam:by('respondeu'), convertidos:by('convertido'), cancelados:by('cancelado'), porLote }; }

function renderTemplate(raw, lead) {
  const safe = (v) => String(v || '');
  return String(raw || '')
    .replaceAll('{{nome}}', safe(lead.nome))
    .replaceAll('{{empresa}}', safe(lead.empresa))
    .replaceAll('{{cidade}}', safe(lead.cidade))
    .replaceAll('{{uf}}', safe(lead.estado || lead.uf))
    .replaceAll('{{whatsapp}}', safe(lead.whatsapp))
    .replaceAll('{{email}}', safe(lead.email))
    .replaceAll('{{launch_batch}}', safe(lead.launch_batch));
}

export async function listLaunchTemplates() { return [...memoryTemplates].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))); }
export async function createLaunchTemplate(payload, options = {}) { const now = new Date().toISOString(); const accountId = resolveAccountId(options) || 'pre-lancamento'; const item = { id: randomUUID(), account_id: accountId, ...payload, created_at: now, updated_at: now }; memoryTemplates.push(item); return item; }
export async function patchLaunchTemplate(id, patch) { const i=memoryTemplates.findIndex((x)=>x.id===id); if(i<0) throw new NotFoundError('Template nao encontrado'); memoryTemplates[i] = { ...memoryTemplates[i], ...patch, updated_at: new Date().toISOString() }; return memoryTemplates[i]; }
export async function deleteLaunchTemplate(id) { return patchLaunchTemplate(id, { status: 'archived' }); }
export async function launchPreview({ leadId, templateId }, options = {}) { const lead = await getInterestLeadById(leadId, options); const tpl = memoryTemplates.find((x)=>x.id===templateId); if(!tpl) throw new NotFoundError('Template nao encontrado'); const preview = { channel: tpl.channel, subject: renderTemplate(tpl.subject || '', lead), body: renderTemplate(tpl.body || '', lead) }; memoryLogs.push({ id: randomUUID(), account_id: resolveAccountId(options) || 'pre-lancamento', lead_id: leadId, template_id: templateId, channel: tpl.channel, status: 'previewed', payload_preview: JSON.stringify(preview), created_at: new Date().toISOString() }); await addEvent(lead, 'launch_preview_gerado', `Preview: ${tpl.name}`); return preview; }
export async function queueLaunch({ leadIds, templateId }, options = {}) { const tpl = memoryTemplates.find((x)=>x.id===templateId); if(!tpl) throw new NotFoundError('Template nao encontrado'); const items=[]; for (const leadId of leadIds){ const lead=await getInterestLeadById(leadId, options); const preview={ channel:tpl.channel, subject: renderTemplate(tpl.subject || '', lead), body: renderTemplate(tpl.body || '', lead)}; memoryLogs.push({ id: randomUUID(), account_id: resolveAccountId(options) || 'pre-lancamento', lead_id: leadId, template_id: templateId, channel: tpl.channel, status: 'queued', payload_preview: JSON.stringify(preview), created_at: new Date().toISOString() }); const updated = await patchInterestLeadInvite(leadId, { inviteStatus: 'agendado' }, options); await addEvent(updated, 'launch_message_queued', `Template: ${tpl.name}`); items.push({ leadId, status:'queued' }); } return { items }; }

export async function convertLeadToSubscriber(id, options = {}) {
  const lead = await getInterestLeadById(id, options);
  if (lead.converted_account_id || lead.converted_at) {
    throw new ConflictError('Lead já convertido.', { code: 'LEAD_ALREADY_CONVERTED', domain: 'pre-lancamento-interest-leads' });
  }
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 15 * 86400000).toISOString();
  const slug = String((lead.empresa || lead.nome || 'conta').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `conta-${Date.now()}`);
  const accountId = randomUUID();
  memoryAccounts.push({ id: accountId, name: lead.empresa || lead.nome, slug, status: 'trial', trial_start_at: now.toISOString(), trial_end_at: trialEndsAt, created_at: now.toISOString(), updated_at: now.toISOString() });
  memoryAccountUsers.push({ id: randomUUID(), account_id: accountId, email: lead.email || `lead-${lead.id}@neuralhire.local`, nome: lead.nome || 'Administrador', role: 'admin', created_at: now.toISOString(), updated_at: now.toISOString() });
  memoryAccountTrials.push({ id: randomUUID(), account_id: accountId, lead_id: lead.id, started_at: now.toISOString(), expires_at: trialEndsAt, status: 'active', created_at: now.toISOString() });
  const updated = await patchInterestLead(lead.id, { status: 'convertido', invite_status: 'convertido', converted_account_id: accountId, converted_at: now.toISOString() }, options);
  await addEvent(updated, 'account_criada', `Account: ${accountId}`);
  await addEvent(updated, 'trial_criado', `Trial ate: ${trialEndsAt}`);
  await addEvent(updated, 'lead_convertido', 'Lead convertido para assinante trial');
  return { accountId, trialEndsAt, status: 'trial' };
}

