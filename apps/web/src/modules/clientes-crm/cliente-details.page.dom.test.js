import assert from 'node:assert/strict';
import test from 'node:test';
import { renderClienteDetailsPage } from './cliente-details.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('cliente details comercial agrupa pedidos por status e mantém accordions fechados por padrão', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ url, params });
      if (url === '/clientes/c1') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente A',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') {
        return {
          items: [
            { id: 'p1', cliente_id: 'c1', numero: '3001', status: 'faturado', valor_total: 300, data_faturamento: '2026-06-12T00:00:00.000Z', created_at: '2026-06-10T00:00:00.000Z', itens: [{ produto: 'Produto A', quantidade: 1, preco_unitario: 300, total: 300 }] },
            { id: 'p2', cliente_id: 'c1', numero: '3002', status: 'cancelado', valor_total: 200, data_faturamento: '2026-06-10T00:00:00.000Z', created_at: '2026-06-09T00:00:00.000Z', itens: [{ produto: 'Produto B', quantidade: 2, preco_unitario: 100, total: 200 }] },
            { id: 'p3', cliente_id: 'c1', numero: '3003', status: 'pendente', valor_total: 150, created_at: '2026-06-11T00:00:00.000Z', itens: [{ produto: 'Produto C', quantidade: 3, preco_unitario: 50, total: 150 }] }
          ],
          pagination: { page: 1, totalPages: 1, total: 3, limit: 100 }
        };
      }
      if (url === '/pedidos/p1') return { item: { id: 'p1', itens: [{ produto: 'Produto A', quantidade: 1, preco_unitario: 300, total: 300 }] } };
      return { items: [] };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="comercial"]')?.click();
  await flush();
  await flush();

  const text = root.textContent.replace(/\s+/g, ' ');
  assert.match(text, /Faturados/);
  assert.match(text, /Em aberto/);
  assert.match(text, /Cancelados/);
  assert.ok(text.indexOf('Faturados') < text.indexOf('Cancelados'));
  assert.ok(!text.includes('Produto A'));

  root.querySelector('[data-toggle-group="faturados"]')?.click();
  await flush();
  await flush();
  assert.match(root.textContent, /Pedido 3001/);
  assert.ok(!root.textContent.includes('Pedido 3002'));
  assert.match(root.textContent, /R\$\s*300,00/);
  assert.match(root.textContent, /12\/06\/2026/);

  root.querySelector('[data-toggle-pedido="p1"]')?.click();
  await flush();
  await flush();
  assert.match(root.textContent, /Produto A/);
  assert.ok(calls.some((call) => call.url === '/pedidos/p1'));

  teardownFrontendDom(dom);
});

test('cliente details comercial calcula total do item e agrupa variações por produto pai', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ url, params });
      if (url === '/clientes/c1') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente A',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') {
        return {
          items: [
            {
              id: 'p1',
              cliente_id: 'c1',
              numero: '3001',
              status: 'faturado',
              valor_total: 0,
              data_faturamento: '2026-06-12T00:00:00.000Z',
              created_at: '2026-06-10T00:00:00.000Z',
              itens: [
                {
                  produto_id: 'prod-golden',
                  produto_nome: 'ROUPÃO GOLDEN',
                  nome_produto_original: 'ROUPÃO GOLDEN',
                  cor_original: 'DOURADO',
                  tamanho_original: 'M',
                  codigo_produto_erp_original: 'RG-01',
                  ean_original: '123',
                  quantidade: 3,
                  valor_unitario: 52.13,
                  status_vinculo: 'vinculado',
                  motivo_vinculo: 'ok'
                },
                {
                  produto_id: 'prod-lady',
                  produto_nome: 'ROUPÃO LADY',
                  nome_produto_original: 'ROUPÃO LADY',
                  cor_original: 'ROSA',
                  tamanho_original: 'P',
                  codigo_produto_erp_original: 'RL-01',
                  quantidade: 1,
                  valor_unitario: 40,
                  valor_total: 40,
                  status_vinculo: 'pendente',
                  motivo_vinculo: 'aguardando'
                },
                {
                  produto_id: 'prod-lady',
                  produto_nome: 'ROUPÃO LADY',
                  nome_produto_original: 'ROUPÃO LADY',
                  cor_original: 'ROSA',
                  tamanho_original: 'M',
                  codigo_produto_erp_original: 'RL-02',
                  quantidade: 2,
                  valor_unitario: 41,
                  valor_total: 82,
                  status_vinculo: 'vinculado',
                  motivo_vinculo: 'ok'
                }
              ]
            }
          ],
          pagination: { page: 1, totalPages: 1, total: 1, limit: 100 }
        };
      }
      if (url === '/pedidos/p1') {
        return {
          item: {
            id: 'p1',
            itens: [
              {
                produto_id: 'prod-golden',
                produto_nome: 'ROUPÃO GOLDEN',
                nome_produto_original: 'ROUPÃO GOLDEN',
                cor_original: 'DOURADO',
                tamanho_original: 'M',
                codigo_produto_erp_original: 'RG-01',
                ean_original: '123',
                quantidade: 3,
                valor_unitario: 52.13,
                status_vinculo: 'vinculado',
                motivo_vinculo: 'ok'
              },
              {
                produto_id: 'prod-lady',
                produto_nome: 'ROUPÃO LADY',
                nome_produto_original: 'ROUPÃO LADY',
                cor_original: 'ROSA',
                tamanho_original: 'P',
                codigo_produto_erp_original: 'RL-01',
                quantidade: 1,
                valor_unitario: 40,
                valor_total: 40,
                status_vinculo: 'pendente',
                motivo_vinculo: 'aguardando'
              },
              {
                produto_id: 'prod-lady',
                produto_nome: 'ROUPÃO LADY',
                nome_produto_original: 'ROUPÃO LADY',
                cor_original: 'ROSA',
                tamanho_original: 'M',
                codigo_produto_erp_original: 'RL-02',
                quantidade: 2,
                valor_unitario: 41,
                valor_total: 82,
                status_vinculo: 'vinculado',
                motivo_vinculo: 'ok'
              }
            ]
          }
        };
      }
      return { items: [] };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="comercial"]')?.click();
  await flush();
  await flush();
  root.querySelector('[data-toggle-group="faturados"]')?.click();
  await flush();
  await flush();
  root.querySelector('[data-toggle-pedido="p1"]')?.click();
  await flush();
  await flush();

  const text = root.textContent.replace(/\s+/g, ' ');
  assert.match(text, /R\$\s*156,39/);
  assert.equal(root.querySelectorAll('.nho2d-product-parent').length, 2);
  assert.equal(root.querySelectorAll('.nho2d-product-variation').length, 3);
  assert.match(root.textContent, /DOURADO/);
  assert.match(root.textContent, /RG-01/);
  assert.match(root.textContent, /vinculado/);
  assert.match(root.textContent, /aguardando/);
  assert.ok(calls.some((call) => call.url === '/pedidos/p1'));

  teardownFrontendDom(dom);
});
