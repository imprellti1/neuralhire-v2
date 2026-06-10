import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';
import { renderPromocoesPage } from './promocoes.page.js';

test('promoções: rota renderiza header, cards e empty state', async () => {
  const dom = setupFrontendDom('#/promocoes');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /promocoes': () => ({ items: [], total: 0 }) });
  bootstrapWebApp();
  await flush();
  assert.match(document.body.textContent, /Promoções/);
  assert.match(document.body.textContent, /Promoções ativas/);
  assert.match(document.body.textContent, /Nenhuma promoção cadastrada\./);
  assert.match(document.body.textContent, /Criar primeira promoção/);
  teardownFrontendDom(dom);
});

test('promoções: lista mostra badges e ações', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async () => ({
      items: [{
        id: 'promo-1',
        nome: 'Campanha Verão',
        produto_nome: 'Camiseta Premium',
        percentual_desconto: 15,
        data_inicio: '2026-06-01',
        data_fim: '2026-06-30',
        status: 'ativa',
        aplicar_em_todas_variacoes: false,
        variacoesSelecionadas: [{ id: 'v1' }]
      }],
      total: 1
    }),
    delete: async () => ({ ok: true })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Campanha Verão/);
  assert.match(document.body.textContent, /Ativa/);
  assert.match(document.body.textContent, /Variações específicas/);
  assert.match(document.body.textContent, /Editar/);
  assert.match(document.body.textContent, /Inativar/);
  teardownFrontendDom(dom);
});

test('promoções: formulário alterna entre todas variações e específicas', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async () => ({ items: [], total: 0 }),
    post: async () => ({ ok: true, item: { id: 'promo-2' } })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  assert.match(document.body.textContent, /Dados da promoção/);
  assert.match(document.body.textContent, /Todas as variações/);
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  assert.match(document.body.textContent, /Variações específicas/);
  teardownFrontendDom(dom);
});
