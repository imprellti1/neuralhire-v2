import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role, accountId, userId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (userId) headers['x-test-user-id'] = userId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getClientesEnrichmentTests() {
  return [
    {
      name: 'CNPJ invalido retorna 422',
      run: async () => {
        __resetMemoryClientesForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente', documento: '123' }, { accountId: 'acc-e1' });
        const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/enriquecer`, role: 'admin', accountId: 'acc-e1' });
        assertEqual(out.res.statusCode, 422);
        assertEqual(out.body.error.code, 'CNPJ_INVALIDO');
      }
    },
    {
      name: 'Cliente inexistente retorna 404',
      run: async () => {
        __resetMemoryClientesForTests();
        const app = createApiApp();
        const out = await call(app, { method: 'POST', url: '/clientes/inexistente/enriquecer', role: 'admin', accountId: 'acc-e2' });
        assertEqual(out.res.statusCode, 404);
        assertEqual(out.body.error.code, 'CLIENTE_NOT_FOUND');
      }
    },
    {
      name: 'Sucesso normaliza e atualiza dados enriquecidos',
      run: async () => {
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            razao_social: 'Empresa LTDA',
            nome_fantasia: 'Empresa',
            cnae_fiscal_descricao: 'Comercio varejista',
            descricao_situacao_cadastral: 'ATIVA',
            data_inicio_atividade: '2020-01-02',
            cep: '01001000',
            logradouro: 'Rua A',
            numero: '100',
            complemento: 'Sala 1',
            bairro: 'Centro',
            municipio: 'Sao Paulo',
            uf: 'SP',
            email: 'contato@empresa.com',
            ddd_telefone_1: '1133334444'
          })
        });
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente', documento: '12.345.678/0001-95' }, { accountId: 'acc-e3' });
          const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/enriquecer`, role: 'admin', accountId: 'acc-e3' });
          assertEqual(out.res.statusCode, 200);
          assertEqual(out.body.item.razao_social, 'Empresa LTDA');
          assertEqual(out.body.item.nome_fantasia, 'Empresa');
          assertEqual(out.body.item.enriquecimento_status, 'concluido');
          assertEqual(out.body.item.enriquecimento_fonte, 'brasilapi');
          assertEqual(out.body.item.cidade, 'Sao Paulo');
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'Falha BrasilAPI persiste status erro',
      run: async () => {
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async () => ({
          ok: false,
          status: 404,
          json: async () => ({ message: 'CNPJ nao encontrado' })
        });
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente', documento: '12.345.678/0001-95' }, { accountId: 'acc-e4' });
          const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/enriquecer`, role: 'admin', accountId: 'acc-e4' });
          assertEqual(out.res.statusCode, 422);
          assertEqual(out.body.error.code, 'BRASILAPI_REJEITOU_CNPJ');
          assertEqual(out.body.error.message.includes('BrasilAPI'), true);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    }
  ];
}
