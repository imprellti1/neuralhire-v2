import assert from 'node:assert/strict';
import {
  __resetLegacyImportStagingMemoryForTests,
  __setLegacyImportStagingSupabaseClientForTests,
  addIssue,
  addRecord,
  createBatch,
  getBatch,
  listBatches,
  getBatchIssues,
  getBatchRecords,
  getLegacyImportStagingRepositoryMode,
  updateBatchStatus
} from '../../modules/legacy-import/legacy-import-staging.repository.js';

function createSupabaseStub() {
  const store = {
    legacy_import_batches: [],
    legacy_import_records: [],
    legacy_import_issues: []
  };

  function table(name) {
    const state = { filters: [], updates: null, insertPayload: null, orderBy: null };
    const api = {
      select() { return api; },
      eq(column, value) { state.filters.push({ column, value }); return api; },
      order(column, options) { state.orderBy = { column, options }; return api; },
      maybeSingle() {
        const row = store[name].find((item) => state.filters.every((filter) => item[filter.column] === filter.value)) || null;
        return Promise.resolve({ data: row, error: null });
      },
      single() {
        return Promise.resolve({ data: state.insertPayload, error: null });
      },
      insert(payload) {
        const item = { id: `stub-${store[name].length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
        store[name].push(item);
        state.insertPayload = item;
        return api;
      },
      update(payload) {
        state.updates = payload;
        return api;
      }
    };
    api.select = () => api;
    api.eq = (column, value) => { state.filters.push({ column, value }); return api; };
    api.order = (column, options) => { state.orderBy = { column, options }; return api; };
    api.maybeSingle = () => {
      const row = store[name].find((item) => state.filters.every((filter) => item[filter.column] === filter.value)) || null;
      return Promise.resolve({ data: row, error: null });
    };
    api.single = () => Promise.resolve({ data: state.insertPayload, error: null });
    api.insert = (payload) => {
      const item = { id: `stub-${store[name].length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
      store[name].push(item);
      state.insertPayload = item;
      return api;
    };
    api.update = (payload) => {
      state.updates = payload;
      return api;
    };
    api.range = () => api;
    api.select = () => api;
    return { api, state };
  }

  const client = {
    store,
    from(name) {
      const { api } = table(name);
      return api;
    }
  };

  return client;
}

function createContext(accountId = 'acc-test-1') {
  return { accountId };
}

export function getLegacyImportStagingTests() {
  return [
    {
      name: 'cria batch em memory',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ source: 'legacy-admin', status: 'pending', dry_run: true }, createContext());
        assert.equal(batch.account_id, 'acc-test-1');
        assert.equal(batch.status, 'pending');
        assert.equal(batch.dry_run, true);
      }
    },
    {
      name: 'aceita status validos de batch',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ source: 'legacy-admin', status: 'validating' }, createContext());
        const updated = await updateBatchStatus(batch.id, 'approved', createContext());
        assert.equal(updated.status, 'approved');
      }
    },
    {
      name: 'insere records e issues vinculados',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ source: 'legacy-admin' }, createContext());
        const record = await addRecord({ batch_id: batch.id, entity: 'clientes', status: 'received', raw_payload: { nome: 'Cliente A' }, issues_count: 1 }, createContext());
        const issue = await addIssue({ batch_id: batch.id, record_id: record.id, entity: 'clientes', field: 'nome', code: 'MISSING', message: 'Nome ausente', severity: 'warning' }, createContext());
        assert.equal(record.batch_id, batch.id);
        assert.equal(issue.record_id, record.id);
        const records = await getBatchRecords(batch.id, createContext());
        const issues = await getBatchIssues(batch.id, createContext());
        assert.equal(records.length, 1);
        assert.equal(issues.length, 1);
      }
    },
    {
      name: 'segrega dados por account',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batchA = await createBatch({ source: 'legacy-admin' }, createContext('acc-a'));
        await addRecord({ batch_id: batchA.id, entity: 'clientes', status: 'received', raw_payload: { nome: 'A' } }, createContext('acc-a'));
        await createBatch({ source: 'legacy-admin' }, createContext('acc-b'));
        assert.equal((await getBatchRecords(batchA.id, createContext('acc-b'))).length, 0);
        await assert.rejects(() => getBatch(batchA.id, createContext('acc-b')));
      }
    },
    {
      name: 'lista batches por account',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const batch = await createBatch({ source: 'legacy-admin' }, createContext('acc-a'));
        const batches = await listBatches(createContext('acc-a'));
        assert.equal(batches[0].id, batch.id);
      }
    },
    {
      name: 'modo memory funciona sem supabase',
      run: () => {
        __resetLegacyImportStagingMemoryForTests();
        assert.equal(getLegacyImportStagingRepositoryMode().mode, 'memory');
      }
    },
    {
      name: 'compatibilidade futura com supabase',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const stub = createSupabaseStub();
        __setLegacyImportStagingSupabaseClientForTests(stub, true);
        const batch = await createBatch({ source: 'legacy-admin', status: 'pending' }, createContext());
        assert.equal(batch.id, 'stub-1');
        assert.equal(stub.store.legacy_import_batches.length, 1);
      }
    }
  ];
}
