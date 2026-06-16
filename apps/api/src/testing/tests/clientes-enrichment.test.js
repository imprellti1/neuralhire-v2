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

function createFetchResponse({ ok, status, body, contentType = 'application/json' }) {
  const textValue = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok,
    status,
    headers: {
      get(name) {
        return String(name || '').toLowerCase() === 'content-type' ? contentType : null;
      }
    },
    text: async () => textValue,
    json: async () => {
      if (contentType.includes('json')) return typeof body === 'string' ? JSON.parse(body) : body;
      return body;
    }
  };
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
      name: 'BrasilAPI 403 usa fallback cnpj.ws com sucesso',
      run: async () => {
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        const calls = [];
        globalThis.fetch = async (url) => {
          calls.push(url);
          if (String(url).includes('brasilapi.com.br')) return createFetchResponse({ ok: false, status: 403, body: { message: { motivo: 'blocked' } } });
          if (String(url).includes('publica.cnpj.ws')) {
            return createFetchResponse({
              ok: true,
              status: 200,
              body: {
                razao_social: 'Empresa LTDA',
                estabelecimento: {
                  nome_fantasia: 'Empresa',
                  atividade_principal: { descricao: 'Comercio varejista' },
                  situacao_cadastral: 'ATIVA',
                  data_inicio_atividade: '2020-01-02',
                  cep: '01001000',
                  logradouro: 'Rua A',
                  numero: '100',
                  complemento: 'Sala 1',
                  bairro: 'Centro',
                  cidade: { nome: 'São Paulo' },
                  estado: { sigla: 'SP' },
                  email: 'contato@empresa.com',
                  ddd1: '11',
                  telefone1: '33334444'
                }
              }
            });
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente', documento: '12.345.678/0001-95' }, { accountId: 'acc-e3' });
          const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/enriquecer`, role: 'admin', accountId: 'acc-e3' });
          assertEqual(out.res.statusCode, 200);
          assertEqual(out.body.item.razao_social, 'Empresa LTDA');
          assertEqual(out.body.item.nome_fantasia, 'Empresa');
          assertEqual(out.body.item.enriquecimento_status, 'concluido');
          assertEqual(out.body.item.enriquecimento_fonte, 'cnpjws');
          assertEqual(out.body.item.cidade, 'São Paulo');
          assertEqual(calls.some((url) => String(url).includes('brasilapi.com.br')), true);
          assertEqual(calls.some((url) => String(url).includes('publica.cnpj.ws')), true);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'BrasilAPI erro + cnpj.ws erro retorna erro amigavel',
      run: async () => {
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        const calls = [];
        globalThis.fetch = async (url) => {
          calls.push(url);
          if (String(url).includes('brasilapi.com.br')) return createFetchResponse({ ok: false, status: 500, body: '<html><body>upstream down</body></html>', contentType: 'text/html' });
          if (String(url).includes('publica.cnpj.ws')) return createFetchResponse({ ok: false, status: 503, body: { error: { message: 'temporarily unavailable' } } });
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente', documento: '12.345.678/0001-95' }, { accountId: 'acc-e4' });
          const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/enriquecer`, role: 'admin', accountId: 'acc-e4' });
          assertEqual(out.res.statusCode, 500);
          assertEqual(out.body.error.message, 'Não foi possível consultar o CNPJ nas fontes disponíveis.');
          assertEqual(out.body.error.message.includes('[object Object]'), false);
          assertEqual(out.body.error.details.brasilapi.includes('upstream down'), true);
          assertEqual(out.body.error.details.cnpjws.includes('temporarily unavailable'), true);
          assertEqual(calls.some((url) => String(url).includes('brasilapi.com.br')), true);
          assertEqual(calls.some((url) => String(url).includes('publica.cnpj.ws')), true);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    }
  ];
}
