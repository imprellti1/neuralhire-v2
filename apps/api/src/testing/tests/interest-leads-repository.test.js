import assert from 'node:assert/strict';
import { assertEqual } from '../assert.js';
import { env } from '../../config/env.js';
import { __resetMemoryInterestLeadsForTests, __setInterestLeadsSupabaseClientForTests, createInterestLead, createInterestLeadEvent, getInterestLeadEvents, getInterestLeadsRepositoryMode, patchInterestLead } from '../../modules/interest-leads/interest-leads.repository.js';

function createSupabaseMock() {
  const state = { leads: [], events: [] };
  return {
    state,
    from(table) {
      const chain = {
        _table: table,
        _filter: {},
        select() { return this; },
        eq(k, v) { this._filter[k] = v; return this; },
        order() { return this; },
        range() { return Promise.resolve({ data: state.leads, count: state.leads.length, error: null }); },
        maybeSingle() {
          if (table === 'interest_leads' && this._pendingUpdate) {
            const i = state.leads.findIndex((x) => (!this._filter.id || x.id === this._filter.id));
            if (i >= 0) state.leads[i] = { ...state.leads[i], ...this._pendingUpdate, updated_at: new Date().toISOString() };
          }
          if (table === 'interest_leads') {
            const item = state.leads.find((x) => (!this._filter.id || x.id === this._filter.id));
            return Promise.resolve({ data: item || null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        single() { return Promise.resolve({ data: state.leads[state.leads.length - 1], error: null }); },
        insert(payload) {
          if (table === 'interest_leads') {
            const item = { id: `l-${state.leads.length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
            state.leads.push(item);
            return this;
          }
          if (table === 'interest_lead_events') {
            state.events.push({ id: `e-${state.events.length + 1}`, created_at: new Date().toISOString(), ...payload });
            return Promise.resolve({ error: null });
          }
          return this;
        },
        update(payload) { this._pendingUpdate = payload; return this; }
      };
      if (table === 'interest_lead_events') {
        chain.order = function () { return Promise.resolve({ data: [...state.events].reverse(), error: null }); };
      }
      return chain;
    }
  };
}

export function getInterestLeadsRepositoryTests() {
  return [
    { name: 'interest-leads repository memory mode', run: async () => { __resetMemoryInterestLeadsForTests(); const mode = getInterestLeadsRepositoryMode(); assertEqual(mode.mode, 'memory'); } },
    { name: 'interest-leads repository supabase mode mockado', run: async () => { __resetMemoryInterestLeadsForTests(); const mock = createSupabaseMock(); __setInterestLeadsSupabaseClientForTests(mock, true); const mode = getInterestLeadsRepositoryMode(); assertEqual(mode.mode, 'supabase'); } },
    { name: 'interest-leads createLead e updateLead supabase mockado', run: async () => { __resetMemoryInterestLeadsForTests(); const previous = { publicInterest: env.PUBLIC_INTEREST_ACCOUNT_ID, interestLeads: env.INTEREST_LEADS_ACCOUNT_ID }; env.PUBLIC_INTEREST_ACCOUNT_ID = 'acc-interest-public'; env.INTEREST_LEADS_ACCOUNT_ID = ''; try { const mock = createSupabaseMock(); __setInterestLeadsSupabaseClientForTests(mock, true); const created = await createInterestLead({ nome: 'Ana', empresa: 'Acme', email: 'ana@acme.com', status: 'novo' }); assertEqual(Boolean(created.id), true); assertEqual(created.account_id, 'acc-interest-public'); const updated = await patchInterestLead(created.id, { status: 'contatado', observacoes: 'ligacao feita' }, { accountId: 'acc-interest-public' }); assertEqual(updated.status, 'contatado'); } finally { env.PUBLIC_INTEREST_ACCOUNT_ID = previous.publicInterest; env.INTEREST_LEADS_ACCOUNT_ID = previous.interestLeads; } } },
    { name: 'interest-leads falha sem conta publica configurada', run: async () => { __resetMemoryInterestLeadsForTests(); const previous = { publicInterest: env.PUBLIC_INTEREST_ACCOUNT_ID, interestLeads: env.INTEREST_LEADS_ACCOUNT_ID }; env.PUBLIC_INTEREST_ACCOUNT_ID = ''; env.INTEREST_LEADS_ACCOUNT_ID = ''; try { const mock = createSupabaseMock(); __setInterestLeadsSupabaseClientForTests(mock, true); await assert.rejects(() => createInterestLead({ nome: 'Ana', empresa: 'Acme', email: 'ana@acme.com', status: 'novo' }), (error) => error.code === 'INTEREST_LEADS_ACCOUNT_NOT_CONFIGURED'); } finally { env.PUBLIC_INTEREST_ACCOUNT_ID = previous.publicInterest; env.INTEREST_LEADS_ACCOUNT_ID = previous.interestLeads; } } },
    { name: 'interest-leads createEvent e listEvents supabase mockado', run: async () => { __resetMemoryInterestLeadsForTests(); const previous = { publicInterest: env.PUBLIC_INTEREST_ACCOUNT_ID, interestLeads: env.INTEREST_LEADS_ACCOUNT_ID }; env.PUBLIC_INTEREST_ACCOUNT_ID = 'acc-interest-public'; env.INTEREST_LEADS_ACCOUNT_ID = ''; try { const mock = createSupabaseMock(); __setInterestLeadsSupabaseClientForTests(mock, true); const created = await createInterestLead({ nome: 'Ana', empresa: 'Acme', email: 'ana@acme.com', status: 'novo' }); await createInterestLeadEvent(created.id, { tipo: 'observacao_adicionada', descricao: 'mensagem enviada' }, { accountId: 'acc-interest-public' }); const events = await getInterestLeadEvents(created.id, { accountId: 'acc-interest-public' }); assertEqual(Array.isArray(events), true); assertEqual(events.length > 0, true); } finally { env.PUBLIC_INTEREST_ACCOUNT_ID = previous.publicInterest; env.INTEREST_LEADS_ACCOUNT_ID = previous.interestLeads; } } }
  ];
}
