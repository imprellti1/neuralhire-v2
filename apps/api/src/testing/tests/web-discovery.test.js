import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiApp } from '../../app.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryTimelineForTests, __resetClientesTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function createFetchResponse({ ok, status, body }) {
  return { ok, status, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) };
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

export function getWebDiscoveryTests() {
  return [
    {
      name: 'POST /clientes/:id/web-discovery retorna erro controlado quando desabilitado',
      run: async () => {
        const previous = process.env.WEB_DISCOVERY_ENABLED;
        process.env.WEB_DISCOVERY_ENABLED = 'false';
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente Discovery', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 400);
          assert.equal(response.body.error.code, 'WEB_DISCOVERY_DISABLED');
        } finally {
          if (previous === undefined) delete process.env.WEB_DISCOVERY_ENABLED;
          else process.env.WEB_DISCOVERY_ENABLED = previous;
        }
      }
    },
    {
      name: 'cliente com site existente não chama provider',
      run: async () => {
        __resetMemoryTimelineForTests();
        __resetClientesTimelineForTests();
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          brave: process.env.BRAVE_SEARCH_API_KEY
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'tavily,ddgs';
        process.env.BRAVE_SEARCH_API_KEY = 'test-key';
        const calls = [];
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (...args) => { calls.push(args[0]); return createFetchResponse({ ok: true, status: 200, body: { web: { results: [] }, results: [] } }); };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente Discovery', cidade: 'Curitiba', estado: 'PR', site: 'https://exemplo.com' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, true);
          assert.equal(response.body.data.provider, 'existing');
          assert.equal(calls.length, 0);
        } finally {
          globalThis.fetch = previousFetch;
          if (previous.enabled === undefined) delete process.env.WEB_DISCOVERY_ENABLED;
          else process.env.WEB_DISCOVERY_ENABLED = previous.enabled;
          if (previous.providers === undefined) delete process.env.WEB_DISCOVERY_PROVIDERS;
          else process.env.WEB_DISCOVERY_PROVIDERS = previous.providers;
          if (previous.brave === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
          else process.env.BRAVE_SEARCH_API_KEY = previous.brave;
        }
      }
    },
    {
      name: 'tavily retorna domínio confiável e atualiza site',
      run: async () => {
        __resetMemoryTimelineForTests();
        __resetClientesTimelineForTests();
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          brave: process.env.BRAVE_SEARCH_API_KEY,
          tavily: process.env.TAVILY_API_KEY,
          min: process.env.WEB_DISCOVERY_MIN_CONFIDENCE
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'tavily,ddgs';
        process.env.TAVILY_API_KEY = 'test-key';
        process.env.WEB_DISCOVERY_MIN_CONFIDENCE = '0.8';
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('tavily.com')) return createFetchResponse({ ok: true, status: 200, body: { results: [{ title: 'Cliente Discovery', url: 'https://cliente-discovery.com.br', content: 'Cliente Discovery em Curitiba PR' }] } });
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente Discovery', razao_social: 'Cliente Discovery LTDA', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, true);
          assert.equal(response.body.data.provider, 'tavily');
          assert.equal(response.body.data.domain, 'cliente-discovery.com.br');
          assert.equal(response.body.data.site, 'https://cliente-discovery.com.br');
          const timeline = await call(app, { method: 'GET', url: `/clientes/${cliente.id}/timeline`, role: 'admin', accountId: 'acc-1' });
          assert.ok(timeline.body.items.some((item) => item.tipo === 'web_discovery_completed'));
        } finally {
          globalThis.fetch = previousFetch;
          process.env.WEB_DISCOVERY_ENABLED = previous.enabled ?? '';
          process.env.WEB_DISCOVERY_PROVIDERS = previous.providers ?? '';
          process.env.BRAVE_SEARCH_API_KEY = previous.brave ?? '';
          process.env.TAVILY_API_KEY = previous.tavily ?? '';
          process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min ?? '';
        }
      }
    },
    {
      name: 'ddgs funciona sem api key',
      run: async () => {
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          tavily: process.env.TAVILY_API_KEY,
          min: process.env.WEB_DISCOVERY_MIN_CONFIDENCE
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'ddgs';
        process.env.WEB_DISCOVERY_MIN_CONFIDENCE = '0.8';
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('duckduckgo.com')) {
            return {
              ok: true,
              status: 200,
              text: async () => '<a class="result__a" href="https://ddgs-exemplo.com.br">DDGS Exemplo</a><a class="result__snippet">Empresa em Curitiba PR</a>'
            };
          }
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'DDGS Exemplo', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, true);
          assert.equal(response.body.data.provider, 'ddgs');
          assert.equal(response.body.data.domain, 'ddgs-exemplo.com.br');
        } finally {
          globalThis.fetch = previousFetch;
          process.env.WEB_DISCOVERY_ENABLED = previous.enabled ?? '';
          process.env.WEB_DISCOVERY_PROVIDERS = previous.providers ?? '';
          process.env.TAVILY_API_KEY = previous.tavily ?? '';
          process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min ?? '';
        }
      }
    },
    {
      name: 'fallback para ddgs quando tavily não encontra',
      run: async () => {
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          tavily: process.env.TAVILY_API_KEY,
          min: process.env.WEB_DISCOVERY_MIN_CONFIDENCE
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'tavily,ddgs';
        process.env.TAVILY_API_KEY = 'test-key';
        process.env.WEB_DISCOVERY_MIN_CONFIDENCE = '0.8';
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('tavily.com')) return createFetchResponse({ ok: true, status: 200, body: { results: [{ title: 'Redirecionador', url: 'https://facebook.com/cliente', content: 'resultado ruim' }] } });
          if (String(url).includes('duckduckgo.com')) {
            return {
              ok: true,
              status: 200,
              text: async () => '<a class="result__a" href="https://cliente-real.com.br">Cliente Real</a><a class="result__snippet">Cliente Real em Curitiba PR</a>'
            };
          }
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente Real', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, true);
          assert.equal(response.body.data.provider, 'ddgs');
          assert.equal(response.body.data.domain, 'cliente-real.com.br');
        } finally {
          globalThis.fetch = previousFetch;
          process.env.WEB_DISCOVERY_ENABLED = previous.enabled ?? '';
          process.env.WEB_DISCOVERY_PROVIDERS = previous.providers ?? '';
          process.env.TAVILY_API_KEY = previous.tavily ?? '';
          process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min ?? '';
        }
      }
    },
    {
      name: 'identifica site oficial com correspondência parcial entre nome fantasia e domínio',
      run: async () => {
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          tavily: process.env.TAVILY_API_KEY,
          min: process.env.WEB_DISCOVERY_MIN_CONFIDENCE
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'tavily,ddgs';
        process.env.TAVILY_API_KEY = 'test-key';
        process.env.WEB_DISCOVERY_MIN_CONFIDENCE = '0.8';
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('tavily.com')) {
            return createFetchResponse({
              ok: true,
              status: 200,
              body: {
                results: [
                  {
                    title: 'Fortsul Atacado de Confecções',
                    url: 'https://compreatacadofortsul.com.br',
                    content: 'ATACADO DE CONFECCOES FORTSUL LTDA em Porto Alegre RS, site oficial.'
                  }
                ]
              }
            });
          }
          if (String(url).includes('duckduckgo.com')) return { ok: true, status: 200, text: async () => '' };
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({
            nome: 'Fortsul',
            razao_social: 'ATACADO DE CONFECCOES FORTSUL LTDA',
            logradouro: 'Rua do Comércio',
            numero: '123',
            cidade: 'Porto Alegre',
            estado: 'RS',
            documento: '12.345.678/0001-90'
          }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, true);
          assert.equal(response.body.data.provider, 'tavily');
          assert.equal(response.body.data.domain, 'compreatacadofortsul.com.br');
          assert.equal(response.body.data.site, 'https://compreatacadofortsul.com.br');
        } finally {
          globalThis.fetch = previousFetch;
          process.env.WEB_DISCOVERY_ENABLED = previous.enabled ?? '';
          process.env.WEB_DISCOVERY_PROVIDERS = previous.providers ?? '';
          process.env.TAVILY_API_KEY = previous.tavily ?? '';
          process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min ?? '';
        }
      }
    },
    {
      name: 'dominio de rede social recebe penalidade',
      run: async () => {
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          brave: process.env.BRAVE_SEARCH_API_KEY,
          min: process.env.WEB_DISCOVERY_MIN_CONFIDENCE
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'tavily';
        process.env.TAVILY_API_KEY = 'test-key';
        process.env.WEB_DISCOVERY_MIN_CONFIDENCE = '0.8';
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('tavily.com')) return createFetchResponse({ ok: true, status: 200, body: { results: [{ title: 'Cliente Discovery', url: 'https://facebook.com/cliente', content: 'Cliente Discovery Curitiba PR' }] } });
          if (String(url).includes('duckduckgo.com')) return { ok: true, status: 200, text: async () => '' };
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente Discovery', razao_social: 'Cliente Discovery LTDA', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, false);
          assert.ok(response.body.data.confidence < 0.8);
        } finally {
          globalThis.fetch = previousFetch;
          if (previous.enabled === undefined) delete process.env.WEB_DISCOVERY_ENABLED;
          else process.env.WEB_DISCOVERY_ENABLED = previous.enabled;
          if (previous.providers === undefined) delete process.env.WEB_DISCOVERY_PROVIDERS;
          else process.env.WEB_DISCOVERY_PROVIDERS = previous.providers;
          if (previous.brave === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
          else process.env.BRAVE_SEARCH_API_KEY = previous.brave;
          if (previous.min === undefined) delete process.env.WEB_DISCOVERY_MIN_CONFIDENCE;
          else process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min;
        }
      }
    },
    {
      name: 'brave não é chamado quando fora da lista de providers',
      run: async () => {
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          brave: process.env.BRAVE_SEARCH_API_KEY,
          tavily: process.env.TAVILY_API_KEY,
          min: process.env.WEB_DISCOVERY_MIN_CONFIDENCE
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'tavily,ddgs';
        process.env.TAVILY_API_KEY = 'test-key';
        process.env.WEB_DISCOVERY_MIN_CONFIDENCE = '0.8';
        const previousFetch = globalThis.fetch;
        const urls = [];
        globalThis.fetch = async (url) => {
          urls.push(String(url));
          if (String(url).includes('tavily.com')) return createFetchResponse({ ok: true, status: 200, body: { results: [] } });
          if (String(url).includes('duckduckgo.com')) return { ok: true, status: 200, text: async () => '' };
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Sem Brave', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.ok(urls.every((item) => !item.includes('brave.com')));
        } finally {
          globalThis.fetch = previousFetch;
          process.env.WEB_DISCOVERY_ENABLED = previous.enabled ?? '';
          process.env.WEB_DISCOVERY_PROVIDERS = previous.providers ?? '';
          process.env.BRAVE_SEARCH_API_KEY = previous.brave ?? '';
          process.env.TAVILY_API_KEY = previous.tavily ?? '';
          process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min ?? '';
        }
      }
    },
    {
      name: 'provider selecionado sem configuração retorna erro controlado',
      run: async () => {
        const previous = {
          enabled: process.env.WEB_DISCOVERY_ENABLED,
          providers: process.env.WEB_DISCOVERY_PROVIDERS,
          tavily: process.env.TAVILY_API_KEY
        };
        process.env.WEB_DISCOVERY_ENABLED = 'true';
        process.env.WEB_DISCOVERY_PROVIDERS = 'tavily';
        delete process.env.TAVILY_API_KEY;
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Sem Tavily', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 422);
          assert.equal(response.body.error.code, 'VALIDATION_ERROR');
        } finally {
          if (previous.enabled === undefined) delete process.env.WEB_DISCOVERY_ENABLED;
          else process.env.WEB_DISCOVERY_ENABLED = previous.enabled;
          if (previous.providers === undefined) delete process.env.WEB_DISCOVERY_PROVIDERS;
          else process.env.WEB_DISCOVERY_PROVIDERS = previous.providers;
          if (previous.tavily === undefined) delete process.env.TAVILY_API_KEY;
          else process.env.TAVILY_API_KEY = previous.tavily;
        }
      }
    }
  ];
}
