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
  const isTextBody = typeof body === 'string';
  return {
    ok,
    status,
    headers: { get: () => (isTextBody ? 'text/html' : 'application/json') },
    json: async () => body,
    text: async () => (isTextBody ? body : JSON.stringify(body))
  };
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
      name: 'enriquecimento digital extrai contatos e redes sociais do HTML simulado',
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
        const calls = [];
        globalThis.fetch = async (url) => {
          calls.push(String(url));
          if (String(url).includes('tavily.com')) return createFetchResponse({ ok: true, status: 200, body: { results: [{ title: 'Cliente Digital', url: 'https://cliente-digital.com.br', content: 'Cliente Digital em Curitiba PR' }] } });
          if (String(url).includes('duckduckgo.com')) return { ok: true, status: 200, text: async () => '' };
          if (String(url).includes('cliente-digital.com.br')) {
            return createFetchResponse({
              ok: true,
              status: 200,
              body: `
                <html><head><title>Cliente Digital</title></head><body>
                  <p>Fale conosco: <a href="mailto:contato@cliente-digital.com.br">contato@cliente-digital.com.br</a> | (41) 3333-2222 | WhatsApp (41) 99999-8888</p>
                  <a href="/sobre">Sobre</a>
                  <a href="https://instagram.com/cliente.digital">Instagram</a>
                  <a href="https://facebook.com/cliente.digital">Facebook</a>
                  <a href="https://www.linkedin.com/company/cliente-digital">LinkedIn</a>
                  <a href="https://youtube.com/@cliente-digital">YouTube</a>
                  <a href="https://www.tiktok.com/@cliente.digital">TikTok</a>
                  <a href="https://marketplace.externo.com/produto-x">Externo</a>
                  <a href="/catalogo/produto-x">Produto X</a>
                  <p>Temos catálogo online, loja virtual, carrinho de compras, checkout e atendimento de segunda a sexta.</p>
                  <button>Comprar</button>
                  <span>À vista ou em até 10x</span>
                  <p>Produto X por R$ 219,90 e Produto Y por 189,90.</p>
                  <p>Segmento moda, categorias roupas e acessórios, marcas Nike e Adidas.</p>
                </body></html>`
            });
          }
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente Digital', cidade: 'Curitiba', estado: 'PR' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, true);
          assert.equal(response.body.data.payload.contacts.emails.includes('contato@cliente-digital.com.br'), true);
          assert.equal(response.body.data.payload.contacts.phones.some((item) => item.includes('3333-2222')), true);
          assert.equal(response.body.data.payload.social.instagram.length > 0, true);
          assert.equal(response.body.data.payload.social.facebook.length > 0, true);
          assert.equal(response.body.data.payload.social.linkedin.length > 0, true);
          assert.equal(response.body.data.payload.social.youtube.length > 0, true);
          assert.equal(response.body.data.payload.social.tiktok.length > 0, true);
          assert.equal(response.body.data.payload.commercial.has_catalog, true);
          assert.equal(response.body.data.payload.commercial.has_ecommerce, true);
          assert.equal(Array.isArray(response.body.data.payload.commercial_profile.ecommerce.categories), true);
          assert.equal(Array.isArray(response.body.data.payload.commercial_profile.ecommerce.price_ranges_by_category), true);
          assert.equal(response.body.data.payload.commercial_profile.ecommerce.categories.length > 0, true);
          assert.equal(response.body.data.payload.commercial_profile.ecommerce.price_ranges_by_category.length > 0, true);
          assert.equal(response.body.data.payload.commercial_profile.ecommerce.price_ranges_by_category[0].sample_count > 0, true);
          assert.ok(calls.some((item) => item.includes('/sobre')));
          assert.ok(!calls.some((item) => item.includes('marketplace.externo.com')));
          const clienteDetalhe = await call(app, { method: 'GET', url: `/clientes/${cliente.id}`, role: 'admin', accountId: 'acc-1' });
          assert.equal(clienteDetalhe.body.item.digital_enrichment_payload.contacts.emails.includes('contato@cliente-digital.com.br'), true);
          assert.equal(clienteDetalhe.body.item.digital_enrichment_status, 'concluido');
        } finally {
          globalThis.fetch = previousFetch;
          if (previous.enabled === undefined) delete process.env.WEB_DISCOVERY_ENABLED;
          else process.env.WEB_DISCOVERY_ENABLED = previous.enabled;
          if (previous.providers === undefined) delete process.env.WEB_DISCOVERY_PROVIDERS;
          else process.env.WEB_DISCOVERY_PROVIDERS = previous.providers;
          if (previous.tavily === undefined) delete process.env.TAVILY_API_KEY;
          else process.env.TAVILY_API_KEY = previous.tavily;
          if (previous.min === undefined) delete process.env.WEB_DISCOVERY_MIN_CONFIDENCE;
          else process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min;
        }
      }
    },
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
      name: 'cliente com site existente não chama provider, mas enriquece usando o site cadastrado',
      run: async () => {
        __resetMemoryTimelineForTests();
        __resetClientesTimelineForTests();
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
        const calls = [];
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          calls.push(String(url));
          if (String(url).includes('tavily.com') || String(url).includes('duckduckgo.com')) {
            throw new Error(`Discovery provider should not be called: ${url}`);
          }
          if (String(url).includes('exemplo.com')) {
            return createFetchResponse({
              ok: true,
              status: 200,
              body: `
                <html><head><title>Exemplo Comercio</title></head><body>
                  <p>Fale com a gente pelo WhatsApp (11) 98888-7777 ou no email contato@exemplo.com</p>
                  <a href="https://instagram.com/exemplo.oficial">Instagram</a>
                  <a href="https://facebook.com/exemplo.oficial">Facebook</a>
                  <a href="/checkout">Checkout</a>
                  <a href="/carrinho">Carrinho</a>
                  <p>Loja virtual com checkout, carrinho e finalizacao da compra.</p>
                </body></html>`
            });
          }
          if (String(url).includes('/sobre') || String(url).includes('/checkout') || String(url).includes('/carrinho')) {
            return createFetchResponse({
              ok: true,
              status: 200,
              body: `
                <html><head><title>Exemplo Comercio</title></head><body>
                  <p>WhatsApp (11) 98888-7777</p>
                  <a href="https://instagram.com/exemplo.oficial">Instagram</a>
                  <a href="https://facebook.com/exemplo.oficial">Facebook</a>
                  <p>Checkout e carrinho disponiveis.</p>
                </body></html>`
            });
          }
          throw new Error(`Unexpected fetch: ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente Discovery', cidade: 'Curitiba', estado: 'PR', site: 'https://exemplo.com' }, { accountId: 'acc-1' });
          const response = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/web-discovery`, role: 'admin', accountId: 'acc-1' });
          assert.equal(response.res.statusCode, 200);
          assert.equal(response.body.data.found, true);
          assert.equal(response.body.data.site, 'https://exemplo.com');
          assert.equal(response.body.data.provider, 'existing');
          assert.ok(calls.some((item) => item === 'https://exemplo.com'));
          assert.equal(calls.some((item) => item.includes('tavily.com') || item.includes('duckduckgo.com')), false);
          assert.equal(response.body.data.payload.social.instagram.length > 0, true);
          assert.equal(response.body.data.payload.social.facebook.length > 0, true);
          assert.equal(response.body.data.payload.contacts.whatsapp.length > 0, true);
          assert.equal(response.body.data.payload.commercial.has_ecommerce, true);
          const clienteDetalhe = await call(app, { method: 'GET', url: `/clientes/${cliente.id}`, role: 'admin', accountId: 'acc-1' });
          assert.equal(clienteDetalhe.body.item.site, 'https://exemplo.com');
          assert.equal(clienteDetalhe.body.item.digital_enrichment_status, 'concluido');
          assert.equal(clienteDetalhe.body.item.digital_enrichment_payload.social.instagram.length > 0, true);
        } finally {
          globalThis.fetch = previousFetch;
          if (previous.enabled === undefined) delete process.env.WEB_DISCOVERY_ENABLED;
          else process.env.WEB_DISCOVERY_ENABLED = previous.enabled;
          if (previous.providers === undefined) delete process.env.WEB_DISCOVERY_PROVIDERS;
          else process.env.WEB_DISCOVERY_PROVIDERS = previous.providers;
          if (previous.tavily === undefined) delete process.env.TAVILY_API_KEY;
          else process.env.TAVILY_API_KEY = previous.tavily;
          if (previous.min === undefined) delete process.env.WEB_DISCOVERY_MIN_CONFIDENCE;
          else process.env.WEB_DISCOVERY_MIN_CONFIDENCE = previous.min;
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
          if (String(url).includes('duckduckgo.com')) return { ok: true, status: 200, text: async () => '' };
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
          const clienteDetalhe = await call(app, { method: 'GET', url: `/clientes/${cliente.id}`, role: 'admin', accountId: 'acc-1' });
          assert.equal(clienteDetalhe.body.item.site, 'https://compreatacadofortsul.com.br');
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
