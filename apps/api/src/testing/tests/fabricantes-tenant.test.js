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
        const { res, body } = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-write', body: { nome: 'Fab Real', site: 'https://fabreal.com', email_comercial: 'contato@fabreal.com', telefone: '11999990000', regiao_atendida: 'BR', logradouro: 'Rua C', numero: '30', complemento: 'Sala 2', bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP', cep: '03000000', account_id: 'malicioso', condicoes_pagamento: [{ prazo: '30/60/90' }] } });
        assertEqual(res.statusCode, 200);
        assertEqual(body.account_id, 'acc-fab-write');
        assertEqual(body.site, 'https://fabreal.com');
        assertEqual(body.email_comercial, 'contato@fabreal.com');
        assertEqual(body.telefone, '11999990000');
        assertEqual(body.regiao_atendida, 'BR');
        assertEqual(body.logradouro, 'Rua C');
        assertEqual(Array.isArray(body.condicoes_pagamento), true);
        assertEqual(body.condicoes_pagamento[0].parcelas, 3);
        assertEqual(body.condicoes_pagamento[0].prazo_medio_dias, 60);
      }
    },
    {
      name: 'PATCH /fabricantes persiste site e contato',
      run: async () => {
        const app = createApiApp();
        const created = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-write-2', body: { nome: 'Fab Edit' } });
        const { body } = await call(app, { method: 'PATCH', url: `/fabricantes/${created.body.id}`, role: 'owner', accountId: 'acc-fab-write-2', body: { site: 'https://edit.com', email_comercial: 'edit@fab.com', telefone: '11911112222', regiao_atendida: 'SP', logradouro: 'Rua D', numero: '40', bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP', cep: '04000000' } });
        assertEqual(body.site, 'https://edit.com');
        assertEqual(body.email_comercial, 'edit@fab.com');
        assertEqual(body.telefone, '11911112222');
        assertEqual(body.regiao_atendida, 'SP');
        assertEqual(body.logradouro, 'Rua D');
      }
    },
    {
      name: 'POST /fabricantes com responsavel valido persiste vinculo',
      run: async () => {
        const app = createApiApp();
        const vendedor = await call(app, { method: 'POST', url: '/vendedores', role: 'account_admin', accountId: 'acc-fab-resp', body: { nome: 'Ana Responsavel', email: 'ana@empresa.com.br' } });
        const { body } = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-resp', body: { nome: 'Fab Resp', responsavel_vendedor_id: vendedor.body.item.id } });
        assertEqual(body.responsavel_vendedor_id, vendedor.body.item.id);
        assertEqual(body.responsavel_comercial_nome, 'Ana Responsavel');
        assertEqual(body.responsavel_comercial_email, 'ana@empresa.com.br');
      }
    },
    {
      name: 'PATCH /fabricantes troca responsavel comercial',
      run: async () => {
        const app = createApiApp();
        const vendedorA = await call(app, { method: 'POST', url: '/vendedores', role: 'account_admin', accountId: 'acc-fab-resp-2', body: { nome: 'Ana 1', email: 'ana1@empresa.com.br' } });
        const vendedorB = await call(app, { method: 'POST', url: '/vendedores', role: 'account_admin', accountId: 'acc-fab-resp-2', body: { nome: 'Ana 2', email: 'ana2@empresa.com.br' } });
        const created = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-resp-2', body: { nome: 'Fab Resp 2', responsavel_vendedor_id: vendedorA.body.item.id } });
        const updated = await call(app, { method: 'PATCH', url: `/fabricantes/${created.body.id}`, role: 'owner', accountId: 'acc-fab-resp-2', body: { responsavel_vendedor_id: vendedorB.body.item.id } });
        assertEqual(updated.body.responsavel_vendedor_id, vendedorB.body.item.id);
        assertEqual(updated.body.responsavel_comercial_nome, 'Ana 2');
      }
    },
    {
      name: 'POST /fabricantes rejeita responsavel de outra conta',
      run: async () => {
        const app = createApiApp();
        const vendedor = await call(app, { method: 'POST', url: '/vendedores', role: 'account_admin', accountId: 'acc-other', body: { nome: 'Vendedor Estranho' } });
        const { res, body } = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-resp-3', body: { nome: 'Fab Bloqueada', responsavel_vendedor_id: vendedor.body.item.id } });
        assertEqual(res.statusCode, 404);
        assertEqual(body.error.code, 'VENDEDOR_NOT_FOUND');
      }
    },
    {
      name: 'POST /fabricantes rejeita responsavel inexistente',
      run: async () => {
        const app = createApiApp();
        const { res, body } = await call(app, { method: 'POST', url: '/fabricantes', role: 'owner', accountId: 'acc-fab-resp-4', body: { nome: 'Fab Bloqueada', responsavel_vendedor_id: '00000000-0000-0000-0000-000000000000' } });
        assertEqual(res.statusCode, 404);
        assertEqual(body.error.code, 'VENDEDOR_NOT_FOUND');
      }
    },
    {
      name: 'POST /fabricantes vendedor comum nao gerencia fabricas',
      run: async () => {
        const app = createApiApp();
        const { res } = await call(app, { method: 'POST', url: '/fabricantes', role: 'sales', accountId: 'acc-fab-sales', userId: 'sales-1', body: { nome: 'Fab Bloqueada' } });
        assertEqual(res.statusCode, 403);
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
      name: 'GET /cnpj/:cnpj normaliza retorno parcial do fallback',
      run: async () => {
        const originalFetch = global.fetch;
        global.fetch = async (url) => ({
          ok: true,
          status: 200,
          text: async () => {
            if (String(url).includes('brasilapi.com.br')) return JSON.stringify({ razao_social: 'fallback' });
            return JSON.stringify({
              razao_social: 'Fallback LTDA',
              nome_fantasia: '',
              emails: [{ email: 'contato@fallback.com' }],
              telefones: [{ ddd: '11', numero: '99990000' }],
              website: 'https://fallback.com',
              endereco: { logradouro: 'Rua F', numero: '1', bairro: 'Centro', municipio: 'Sao Paulo', uf: 'SP', cep: '01000000' }
            });
          }
        });
        try {
          const app = createApiApp();
          const { body } = await call(app, { method: 'GET', url: '/cnpj/12345678000190', role: 'owner', accountId: 'acc-fab-cnpj' });
          assertEqual(body.ok, true);
          assertEqual(body.data.razao_social, 'Fallback LTDA');
          assertEqual(body.data.email, 'contato@fallback.com');
          assertEqual(body.data.telefone, '1199990000');
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
