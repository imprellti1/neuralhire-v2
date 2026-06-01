import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProdutoDetailsPage } from './produto-details.page.js';
import { dispatchChange, dispatchInput, dispatchKeydown, findButtonByText, flush, mockAnchorClicks, mockObjectUrl, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { createProdutoUsageMockData } from '../../testing/mocks/produtos.mock.js';

test('produto 360 acessibilidade e edição seguem funcionais', async () => {
  const dom = setupFrontendDom('#/produtos/p1');
  mockObjectUrl();
  const anchorMock = mockAnchorClicks(dom);

  const usage = createProdutoUsageMockData();
  let patched = null;
  const apiClient = {
    async get(path) {
      if (path === '/produtos/p1') return { item: { id: 'p1', nome: 'Produto A', sku: 'SKU1', categoria: 'Cat', preco: 10, status: 'ativo', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-05-01T00:00:00.000Z' } };
      if (path === '/pedidos') return { items: usage.pedidos };
      if (path.startsWith('/pedidos/')) return { id: path.split('/').pop(), itens: usage.detalhes[path.split('/').pop()] || [] };
      throw new Error(`unhandled get ${path}`);
    },
    async patch(path, payload) { patched = { path, payload }; return { item: { id: 'p1' } }; }
  };

  const root = document.getElementById('root');
  renderProdutoDetailsPage(root, { apiClient, produtoId: 'p1' });
  await flush(); await flush(); await flush();
  assert.ok(findButtonByText('Editar Produto'));
  assert.ok(findButtonByText('Exportar CSV da lista atual'));
  const hit = root.querySelector('.nhpd-chart-hit');
  hit.focus();
  hit.dispatchEvent(new Event('focus', { bubbles: true }));
  assert.notEqual(root.querySelector('#nhpd-chart-tooltip').textContent.trim(), '');
  dispatchKeydown(hit, 'Enter');
  await flush();
  assert.ok(findButtonByText('Limpar seleção do drill-down'));
  findButtonByText('Limpar seleção do drill-down').click();
  await flush();
  dispatchKeydown(hit, ' ');
  await flush();
  findButtonByText('Editar Produto').click();
  dispatchInput(root.querySelector('#nhpd-nome'), 'Produto B');
  findButtonByText('Salvar alterações').click();
  await flush(); await flush();
  assert.equal(patched.path, '/produtos/p1');
  dispatchChange(root.querySelector('#nhpd-usage-period'), '7d');
  await flush();
  findButtonByText('Exportar CSV da lista atual').click();
  findButtonByText('Exportar CSV do período filtrado').click();
  assert.equal(anchorMock.clicks.length, 2);
  anchorMock.restore();
  teardownFrontendDom(dom);
});
