import assert from 'node:assert/strict';
import test from 'node:test';
import xlsx from 'xlsx';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryClientesForTests, createCliente, __dumpMemoryClientes } from '../../modules/clientes/clientes.repository.js';
import { __resetClientesImportSessionsForTests, __normalizeClientesImportMoneyForTests, __normalizeClientesImportDigitsForTests } from '../../modules/clientes-import/clientes-import.repository.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  let payload = null;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const req = createTestRequest({ method, url, headers, body: payload });
  const res = createTestResponse();
  return app(req, res).then(() => ({ res, body: parseBody(res) }));
}

function makeWorkbook(rows) {
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'ag-grid');
  return xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
}

function createSupabaseMock({ insertError = null, onInsert = null } = {}) {
  const store = [];
  const chain = {
    insert(payload) {
      if (onInsert) onInsert(payload);
      return {
        select() {
          return {
            single: async () => {
              if (insertError) return { data: null, error: insertError };
              const created = { id: `cliente-${store.length + 1}`, ...payload };
              store.push(created);
              return { data: created, error: null };
            }
          };
        }
      };
    },
    eq() { return chain; },
    order() { return chain; },
    range: async () => ({ data: [], count: 0, error: null }),
    maybeSingle: async () => ({ data: null, error: null })
  };
  return {
    from() {
      return chain;
    }
  };
}

export function getClientesImportTests() {
  return [
    {
      name: 'normaliza moeda brasileira e cnpj',
      run: async () => {
        assert.equal(__normalizeClientesImportMoneyForTests('R$200.000,00'), 200000);
        assert.equal(__normalizeClientesImportDigitsForTests('12.345.678/0001-90'), '12345678000190');
      }
    },
    {
      name: 'preview mapeia planilha real e ignora colunas descartadas',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const app = createApiApp();
        const base64 = makeWorkbook([
          { Código: '001', CNPJ: '12.345.678/0001-90', 'Razão Social': 'Cliente A LTDA', Fantasia: 'Cliente A', Situação: 'Ativo', 'Limite de Crédito': 'R$200.000,00', 'Limite de Crédito Disponível': 'R$150.000,00', Cidade: 'São Paulo', Bairro: 'Centro', UF: 'sp', 'Tempo sem compra': '30', 'Painel do Cliente': 'x' }
        ]);
        const out = await call(app, { method: 'POST', url: '/clientes/importacao/preview', role: 'admin', accountId: 'acc-clientes-import', body: { arquivo: { fileName: 'Clientes_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(out.body.summary.novos, 1);
        assert.equal(out.body.rows[0].metadata.codigo_fabrica, '001');
        assert.equal(out.body.rows[0].metadata.nome_fantasia, 'Cliente A');
        assert.equal(out.body.rows[0].metadata.limite_credito, 200000);
        assert.equal(out.body.rows[0].metadata.limite_credito_disponivel, 150000);
        assert.equal(out.body.rows[0].metadata.origem_importacao, 'clientes_fabrica');
        assert.equal(out.body.rows[0].ativo, true);
        assert.equal(out.body.rows[0].ativoLabel, 'Sim');
      }
    },
    {
      name: 'preview marca Inativo como ativo nao',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const app = createApiApp();
        const base64 = makeWorkbook([
          { Código: '010', CNPJ: '22.222.222/2222-22', 'Razão Social': 'Cliente B LTDA', Situação: 'Inativo', Cidade: 'São Paulo', UF: 'SP' }
        ]);
        const out = await call(app, { method: 'POST', url: '/clientes/importacao/preview', role: 'admin', accountId: 'acc-clientes-import', body: { arquivo: { fileName: 'Clientes_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.body.rows[0].ativo, false);
        assert.equal(out.body.rows[0].ativoLabel, 'Não');
        assert.equal(out.body.rows[0].metadata.situacao_original, 'Inativo');
      }
    },
    {
      name: 'detecta existente por documento e por codigo da fabrica',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente Existente', documento: '12345678000190', metadata: { codigo_fabrica: '001' } }, { accountId: 'acc-clientes-import' });
        const base64 = makeWorkbook([
          { Código: '001', CNPJ: '12.345.678/0001-90', 'Razão Social': 'Cliente B LTDA', Cidade: 'São Paulo', UF: 'SP' },
          { Código: '002', CNPJ: '98.765.432/0001-10', 'Razão Social': 'Cliente C LTDA', Cidade: 'São Paulo', UF: 'SP' }
        ]);
        const out = await call(app, { method: 'POST', url: '/clientes/importacao/preview', role: 'admin', accountId: 'acc-clientes-import', body: { arquivo: { fileName: 'Clientes_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.body.summary.existentes, 1);
        assert.equal(out.body.rows[0].status, 'existente');
      }
    },
    {
      name: 'bloqueia linha sem Razão Social e CNPJ invalido',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const app = createApiApp();
        const base64 = makeWorkbook([
          { Código: '001', CNPJ: '', 'Razão Social': '', Cidade: 'São Paulo', UF: 'SP' },
          { Código: '002', CNPJ: '123', 'Razão Social': 'Cliente D LTDA', Cidade: 'São Paulo', UF: 'SP' }
        ]);
        const out = await call(app, { method: 'POST', url: '/clientes/importacao/preview', role: 'admin', accountId: 'acc-clientes-import', body: { arquivo: { fileName: 'Clientes_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.body.summary.invalidos, 2);
        assert.equal(out.body.rows[0].status, 'invalido');
        assert.match(out.body.rows[0].errors.join(' '), /Razão Social obrigatória/);
      }
    },
    {
      name: 'importacao insere somente novos e ignora existentes e duplicados',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente Existente', documento: '12345678000190', metadata: { codigo_fabrica: '001' } }, { accountId: 'acc-clientes-import' });
        const base64 = makeWorkbook([
          { Código: '001', CNPJ: '12.345.678/0001-90', 'Razão Social': 'Cliente B LTDA', Cidade: 'São Paulo', UF: 'SP' },
          { Código: '002', CNPJ: '98.765.432/0001-10', 'Razão Social': 'Cliente C LTDA', Cidade: 'São Paulo', UF: 'SP' },
          { Código: '003', CNPJ: '98.765.432/0001-10', 'Razão Social': 'Cliente C LTDA', Cidade: 'São Paulo', UF: 'SP' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/clientes/importacao/preview', role: 'admin', accountId: 'acc-clientes-import', body: { arquivo: { fileName: 'Clientes_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        const run = await call(app, { method: 'POST', url: '/clientes/importacao', role: 'admin', accountId: 'acc-clientes-import', body: { importToken: preview.body.importToken } });
        assert.equal(run.body.ok, true);
        assert.equal(run.body.inserted.length, 1);
        assert.equal(run.body.ignorados_existentes.length, 1);
        assert.equal(run.body.possiveis_duplicados.length, 1);
        assert.equal(__dumpMemoryClientes().filter((item) => item.account_id === 'acc-clientes-import').length >= 2, true);
      }
    },
    {
      name: 'createCliente aceita metadata de importacao no modo supabase',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const previous = globalThis.__NEURALHIRE_SUPABASE_MOCK__;
        const captured = [];
        globalThis.__NEURALHIRE_SUPABASE_MOCK__ = createSupabaseMock({
          onInsert: (payload) => captured.push(payload)
        });
        try {
          const created = await createCliente({
            nome: 'Cliente com metadata',
            documento: '12345678000190',
            cidade: 'São Paulo',
            estado: 'SP',
            ativo: true,
            metadata: { codigo_fabrica: '001', origem_importacao: 'clientes_fabrica' },
            tags: []
          }, { accountId: 'acc-clientes-import' });
          assert.equal(created.nome, 'Cliente com metadata');
          assert.equal(captured[0].metadata.codigo_fabrica, '001');
          assert.equal(captured[0].account_id, 'acc-clientes-import');
          assert.equal('owner_user_id' in captured[0], false);
        } finally {
          if (previous === undefined) delete globalThis.__NEURALHIRE_SUPABASE_MOCK__;
          else globalThis.__NEURALHIRE_SUPABASE_MOCK__ = previous;
        }
      }
    },
    {
      name: 'erro de importacao aponta linha e motivo do repository',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const app = createApiApp();
        const previous = globalThis.__NEURALHIRE_SUPABASE_MOCK__;
        globalThis.__NEURALHIRE_SUPABASE_MOCK__ = createSupabaseMock({
          insertError: { message: 'null value in column "nome" violates not-null constraint', code: '23502' }
        });
        try {
          const base64 = makeWorkbook([
            { Código: '009', CNPJ: '11.111.111/1111-11', 'Razão Social': 'Cliente X LTDA', Cidade: 'Curitiba', UF: 'PR' }
          ]);
          const preview = await call(app, { method: 'POST', url: '/clientes/importacao/preview', role: 'admin', accountId: 'acc-clientes-import', body: { arquivo: { fileName: 'Clientes_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
          const run = await call(app, { method: 'POST', url: '/clientes/importacao', role: 'admin', accountId: 'acc-clientes-import', body: { importToken: preview.body.importToken } });
          assert.equal(run.res.statusCode, 500);
          assert.match(String(run.body.message || ''), /linha 2/i);
          assert.match(String(run.body.message || ''), /null value in column/i);
        } finally {
          if (previous === undefined) delete globalThis.__NEURALHIRE_SUPABASE_MOCK__;
          else globalThis.__NEURALHIRE_SUPABASE_MOCK__ = previous;
        }
      }
    },
    {
      name: 'account_id externo e ignorado pelo contexto autenticado',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetClientesImportSessionsForTests();
        const app = createApiApp();
        const base64 = makeWorkbook([
          { Código: '009', CNPJ: '11.111.111/1111-11', 'Razão Social': 'Cliente X LTDA', Cidade: 'Curitiba', UF: 'PR' }
        ]);
        const out = await call(app, { method: 'POST', url: '/clientes/importacao/preview', role: 'admin', accountId: 'acc-real', body: { account_id: 'acc-forged', arquivo: { fileName: 'Clientes_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
      }
    }
  ];
}
