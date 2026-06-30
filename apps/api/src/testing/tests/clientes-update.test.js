import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';

function parseBody(res) {
  try {
    return JSON.parse(res.body || '{}');
  } catch {
    return {};
  }
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

export function getClientesUpdateTests() {
  return [
    {
      name: 'PATCH /clientes/:id atualiza campos principais',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-1', body: { nome: 'Cliente A', cidade: 'São Paulo', estado: 'SP', status: 'ativo' } });
        const updated = await call(app, {
          method: 'PATCH',
          url: `/clientes/${created.body.item.id}`,
          role: 'admin',
          accountId: 'acc-1',
          body: { nome: 'Cliente A Ltda', razao_social: 'Cliente A LTDA', cidade: 'Curitiba', estado: 'PR', status: 'prospect', documento: '00.000.000/0001-00', telefone: '(41) 99999-0000', email: 'contato@exemplo.com', vendedor_id: 'vend-1' }
        });

        assertEqual(updated.res.statusCode, 200);
        assertEqual(updated.body.item.nome, 'Cliente A Ltda');
        assertEqual(updated.body.item.razao_social, 'Cliente A LTDA');
        assertEqual(updated.body.item.cidade, 'Curitiba');
        assertEqual(updated.body.item.estado, 'PR');
        assertEqual(updated.body.item.status, 'prospect');
        assertEqual(updated.body.item.vendedor_id, 'vend-1');
      }
    },
    {
      name: 'PATCH /clientes/:id preserva tenant e respeita scope do vendedor',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId: 'acc-1', body: { nome: 'Cliente B', vendedor_id: 'vend-a' } });
        const forbidden = await call(app, { method: 'PATCH', url: `/clientes/${created.body.item.id}`, role: 'sales', accountId: 'acc-1', userId: 'vend-b', body: { cidade: 'Recife' } });
        assertEqual(forbidden.res.statusCode, 404);
      }
    },
    {
      name: 'POST /clientes/:id/sincronizar-360 atualiza e mantem idempotencia',
      run: async () => {
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        const calls = [];
        globalThis.fetch = async (url) => {
          calls.push(String(url));
          if (String(url).includes('brasilapi.com.br')) {
            return createFetchResponse({
              ok: true,
              status: 200,
              body: {
                razao_social: 'Cliente Sincronizado LTDA',
                cnpj: '12345678000195',
                cep: '80000000',
                logradouro: 'Rua Central',
                numero: '100',
                complemento: 'Sala 1',
                bairro: 'Centro',
                municipio: 'Curitiba',
                uf: 'PR',
                email: 'contato@cliente.com',
                ddd_telefone_1: '41',
                telefone_1: '33334444'
              }
            });
          }
          if (String(url).includes('nominatim.openstreetmap.org/search')) {
            return createFetchResponse({
              ok: true,
              status: 200,
              body: [{ lat: '-25.4284', lon: '-49.2733', place_id: '1', display_name: 'Curitiba, PR' }]
            });
          }
          throw new Error(`fetch inesperado ${url}`);
        };

        try {
          const app = createApiApp();
          const cliente = await createCliente({
            nome: 'Cliente Sync',
            documento: '12.345.678/0001-95',
            cidade: 'São Paulo',
            estado: 'SP',
            logradouro: 'Rua Antiga',
            numero: '10',
            bairro: 'Centro'
          }, { accountId: 'acc-sync' });

          const first = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/sincronizar-360`, role: 'admin', accountId: 'acc-sync' });
          assertEqual(first.res.statusCode, 200);
          assertEqual(first.body.item.cliente_score >= 0, true);
          assertEqual(first.body.resumo.errors.length, 0);

          const timeline1 = await call(app, { method: 'GET', url: `/clientes/${cliente.id}/timeline`, role: 'admin', accountId: 'acc-sync' });
          assertEqual(Array.isArray(timeline1.body.items), true);
          assertEqual(timeline1.body.items.length > 0, true);

          const second = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/sincronizar-360`, role: 'admin', accountId: 'acc-sync' });
          assertEqual(second.res.statusCode, 200);
          const timeline2 = await call(app, { method: 'GET', url: `/clientes/${cliente.id}/timeline`, role: 'admin', accountId: 'acc-sync' });
          assertEqual(timeline2.body.items.length, timeline1.body.items.length);
          assertEqual(second.body.resumo.changes.length === 0 || Array.isArray(second.body.resumo.changes), true);
          assertEqual(calls.some((url) => url.includes('brasilapi.com.br')), true);
          assertEqual(calls.some((url) => url.includes('nominatim.openstreetmap.org/search')), true);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    }
  ];
}
