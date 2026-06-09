import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProdutoDetailsPage } from './produto-details.page.js';
import { findButtonByText, flush, mockAnchorClicks, mockObjectUrl, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { createProdutoUsageMockData } from '../../testing/mocks/produtos.mock.js';

test('produto 360 mantém o layout e o toggle de variações', async () => {
  const dom = setupFrontendDom('#/produtos/p1');
  mockObjectUrl();
  const anchorMock = mockAnchorClicks(dom);

  const usage = createProdutoUsageMockData();
  const apiClient = {
    async get(path) {
      if (path === '/produtos/p1') {
        return {
          item: {
            id: 'p1',
            nome: 'Produto A',
            sku: 'SKU1',
            categoria: 'Cat',
            descricao: 'Produto A',
            preco: 10,
            status: 'ativo',
            ativo: true,
            fabricante_id: 'fab-1',
            fabricante_nome: 'Fábrica 1',
            fabricante_logo_url: 'https://example.com/logo.png',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z'
          }
        };
      }
      if (path === '/product-editor/products/p1') {
        return {
          item: {
            id: 'p1',
            nome: 'Produto A',
            sku: 'SKU1',
            categoria: 'Cat',
            descricao: 'Produto A',
            preco: 10,
            status: 'ativo',
            ativo: true,
            fabricante_id: 'fab-1',
            fabricante_nome: 'Fábrica 1',
            fabricante_logo_url: 'https://example.com/logo.png',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
            variations: [
              { id: 'v1', sku: 'SKU1-01', cor: 'Azul', grade: 'P', estoque_atual: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-03T00:00:00.000Z' },
              { id: 'v2', sku: 'SKU1-02', cor: 'Azul', grade: 'M', estoqueAtual: 2, preco: 12, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-04T00:00:00.000Z' },
              { id: 'v3', sku: 'SKU1-03', cor: 'Azul', grade: 'G', estoque: 2, preco: 12, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-05T00:00:00.000Z' },
              { id: 'v4', sku: 'SKU1-04', cor: 'Azul', grade: 'GG', estoque: 2, preco: 12, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-06T00:00:00.000Z' }
            ]
          }
        };
      }
      if (path === '/fabricantes') return { items: [{ id: 'fab-1', nome: 'Fábrica 1' }] };
      if (path === '/pedidos') return { items: usage.pedidos };
      if (path.startsWith('/pedidos/')) return { id: path.split('/').pop(), itens: usage.detalhes[path.split('/').pop()] || [] };
      if (path === '/produtos/p1/imagens') return { items: [{ id: 'img-1', produto_id: 'p1', variacao_id: null, url: 'https://example.com/img.jpg', storage_path: 'acc/p1/pai/img.jpg', ordem: 0, principal: true, tipo: 'image' }] };
      throw new Error(`unhandled get ${path}`);
    },
    async patch() { return { item: { id: 'p1' } }; }
  };

  const root = document.getElementById('root');
  renderProdutoDetailsPage(root, { apiClient, produtoId: 'p1' });
  await flush(); await flush(); await flush();

  assert.ok(findButtonByText('Voltar'));
  assert.ok(findButtonByText('Editar Produto'));

  const bodyText = root.textContent;
  assert.match(bodyText, /Fábrica 1/);
  assert.doesNotMatch(bodyText, /CNPJ|Pedido mínimo|Duplicata mínima|Comissão padrão|Condição de pagamento|Bonificação|Consignação|Vendedor/);
  assert.doesNotMatch(bodyText, /Auditoria/);
  assert.doesNotMatch(bodyText, /SKU  SKU1 • Cat/);
  assert.doesNotMatch(bodyText, /Descrição\s*Produto A/);
  assert.doesNotMatch(bodyText, /Ativo\/Inativo/);
  assert.match(bodyText, /Estoque total \(todas as variações\)\s*8/);
  assert.match(bodyText, /Variações do Produto/);
  assert.match(bodyText, /SKU1-01/);
  assert.match(bodyText, /SKU1-02/);
  assert.match(bodyText, /SKU1-03/);
  assert.match(bodyText, /SKU1-04/);

  const toggle = root.querySelector('#nhpd-variations-toggle');
  assert.ok(toggle);
  toggle.click();
  await flush();
  assert.equal(root.textContent.includes('SKU1-01'), false);
  toggle.click();
  await flush();
  assert.equal(root.textContent.includes('SKU1-01'), true);

  assert.ok(findButtonByText('Exportar CSV da lista atual'));
  assert.ok(findButtonByText('Exportar CSV do período filtrado'));
  findButtonByText('Editar Produto').click();
  await flush();
  assert.ok(root.querySelector('#nhpd-fabricante_id'));

  anchorMock.restore();
  teardownFrontendDom(dom);
});
