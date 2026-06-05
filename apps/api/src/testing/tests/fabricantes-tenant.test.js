import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

function parseBody(res) {
  try {
    return JSON.parse(res.body || '{}');
  } catch {
    return {};
  }
}

async function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getFabricantesTenantTests() {
  return [
    {
      name: 'GET /fabricantes com tenant retorna lista vazia',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-read' });
        assertEqual(res.statusCode, 200);
        assertEqual(Array.isArray(body.items), true, 'Deve retornar items');
        assertEqual(body.items.length, 0, 'Lista deve vir vazia em tenant isolado');
      }
    },
    {
      name: 'GET /fabricantes sem tenant retorna TENANT_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/fabricantes', role: 'owner' });
        assertEqual(res.statusCode, 403);
        assertEqual(body.error.code, 'TENANT_REQUIRED');
      }
    },
    {
      name: 'POST /fabricantes sem tenant retorna TENANT_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', body: { nome: 'Fab Teste' } });
        assertEqual(res.statusCode, 403);
        assertEqual(body.error.code, 'TENANT_REQUIRED');
      }
    },
    {
      name: 'POST /fabricantes com tenant cria item no account correto',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-write', body: { nome: 'Fab Real' } });
        assertEqual(res.statusCode, 200);
        assertEqual(body.account_id, 'acc-fab-write');
      }
    },
    {
      name: 'GET /cnpj/:cnpj sem auth retorna AUTH_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/cnpj/12345678000190' });
        assertEqual(res.statusCode, 401);
        assertEqual(body.error.code, 'AUTH_REQUIRED');
      }
    },
    {
      name: 'GET /cnpj/:cnpj sem tenant retorna TENANT_REQUIRED',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/cnpj/12345678000190', role: 'owner' });
        assertEqual(res.statusCode, 403);
        assertEqual(body.error.code, 'TENANT_REQUIRED');
      }
    },
    {
      name: 'GET /cnpj/:cnpj invalido retorna 400',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'GET', url: '/cnpj/123', role: 'owner', accountId: 'acc-fab-cnpj' });
        assertEqual(res.statusCode, 400);
        assertEqual(body.error.code, 'CNPJ_INVALIDO');
      }
    },
    {
      name: 'GET /cnpj/:cnpj consulta provider mockado',
      run: async () => {
        const originalFetch = global.fetch;
        global.fetch = async () => ({
          ok: true,
          json: async () => ({
            razao_social: 'Empresa Teste LTDA',
            nome_fantasia: 'Teste',
            descricao_situacao_cadastral: 'ATIVA',
            email: 'contato@teste.com',
            ddd_telefone_1: '(11) 99999-0000',
            website: 'https://teste.com',
            address: { logradouro: 'Rua X', numero: '10', complemento: 'sala 1', bairro: 'Centro', municipio: 'Sao Paulo', uf: 'SP', cep: '01000000' },
            cnae_fiscal_detalhes: [{ descricao: 'Comercio atacadista' }]
          })
        });
        try {
          const app = createApiApp();
          const { res, body } = await call(app, { method: 'GET', url: '/cnpj/12345678000190', role: 'owner', accountId: 'acc-fab-cnpj' });
          assertEqual(res.statusCode, 200);
          assertEqual(body.ok, true);
          assertEqual(body.data.cnpj, '12345678000190');
          assertEqual(body.data.razao_social, 'Empresa Teste LTDA');
        } finally {
          global.fetch = originalFetch;
        }
      }
    },
    {
      name: 'GET /cnpj/:cnpj faz fallback quando BrasilAPI falha',
      run: async () => {
        const originalFetch = global.fetch;
        global.fetch = async (url) => {
          if (String(url).includes('brasilapi.com.br')) {
            return { ok: false, status: 403, text: async () => '{"message":"forbidden"}' };
          }
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              razao_social: 'Fallback LTDA',
              nome_fantasia: 'Fallback',
              situacao_cadastral: 'ATIVA',
              endereco: { logradouro: 'Rua F', numero: '1', bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP', cep: '01000000' }
            })
          };
        };
        try {
          const app = createApiApp();
          const { res, body } = await call(app, { method: 'GET', url: '/cnpj/12345678000190', role: 'owner', accountId: 'acc-fab-cnpj' });
          assertEqual(res.statusCode, 200);
          assertEqual(body.ok, true);
          assertEqual(body.data.razao_social, 'Fallback LTDA');
        } finally {
          global.fetch = originalFetch;
        }
      }
    },
    {
      name: 'GET /cnpj/:cnpj retorna fallback amigavel quando todos providers falham',
      run: async () => {
        const originalFetch = global.fetch;
        global.fetch = async () => ({ ok: false, status: 503, text: async () => 'down' });
        try {
          const app = createApiApp();
          const { res, body } = await call(app, { method: 'GET', url: '/cnpj/12345678000190', role: 'owner', accountId: 'acc-fab-cnpj' });
          assertEqual(res.statusCode, 200);
          assertEqual(body.ok, true);
          assertEqual(body.found, false);
        } finally {
          global.fetch = originalFetch;
        }
      }
    },
    {
      name: 'isolation de fabricantes por account_id',
      run: async () => {
        const app = createApiApp();
        await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-a', body: { nome: 'Fab A' } });
        await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-b', body: { nome: 'Fab B' } });
        const { body } = await call(app, { method: 'GET', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-a' });
        assertEqual(body.items.every((item) => item.account_id === 'acc-fab-a'), true);
      }
    }
  ];
}
