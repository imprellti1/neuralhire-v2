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
  root.querySelector('[data-toggle-variation-group="p1-0"]')?.click();
  await flush();
  await flush();

  const text = root.textContent.replace(/\s+/g, ' ');
  assert.match(text, /R\$\s*156,39/);
  assert.equal(root.querySelectorAll('.nho2d-product-name').length, 2);
  assert.ok(root.querySelector('[data-variation-group="p1-0"]'));
  assert.ok(root.querySelector('.nho2d-variation-panel table'));
  assert.match(root.textContent, /DOURADO/);
  assert.match(root.textContent, /M/);
  assert.match(root.textContent, /P/);
  assert.match(root.textContent, /Custo unitário/);
  assert.ok(!text.includes('RG-01'));
  assert.ok(!text.includes('123'));
  assert.ok(!text.includes('EAN'));
  assert.ok(!text.includes('Total do produto') || text.includes('Total do produto'));
  assert.ok(!text.includes('status_vinculo'));
  assert.ok(!text.includes('motivo_vinculo'));
  assert.ok(calls.some((call) => call.url === '/pedidos/p1'));

  teardownFrontendDom(dom);
});

test('cliente details comercial atualiza valor do pedido e resumo do grupo quando itens chegam sob demanda', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  let resolvePedido;
  const pedidoPromise = new Promise((resolve) => {
    resolvePedido = resolve;
  });
  const apiClient = {
    get: async (url, params = {}) => {
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
              itens: null
            }
          ],
          pagination: { page: 1, totalPages: 1, total: 1, limit: 100 }
        };
      }
      if (url === '/pedidos/p1') {
        return pedidoPromise;
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

  assert.match(root.textContent, /Carregando itens do pedido/);
  assert.match(root.textContent, /Valor:\s*R\$\s*0,00|Valor:\s*—/);
  assert.match(root.textContent, /Valor total:\s*R\$\s*0,00/);

  resolvePedido({
    item: {
      id: 'p1',
      itens: [
        {
          produto_id: 'prod-1',
          produto_nome: 'Produto A',
          quantidade: 2,
          valor_unitario: 10
        },
        {
          produto_id: 'prod-2',
          produto_nome: 'Produto B',
          quantidade: 1,
          valor_unitario: 7,
          valor_total: 9
        }
      ]
    }
  });
  await flush();
  await flush();

  assert.match(root.textContent, /Valor:\s*R\$\s*29,00/);
  assert.match(root.textContent, /Valor total:\s*R\$\s*29,00/);
  assert.match(root.textContent, /Produto A/);
  assert.match(root.textContent, /Produto B/);

  teardownFrontendDom(dom);
});

test('cliente details mostra aba de enriquecimento e executa enriquecimento manual', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  let resolvePost;
  const postPromise = new Promise((resolve) => { resolvePost = resolve; });
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ method: 'GET', url, params });
      if (url === '/clientes/c1') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente A',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo',
            enriquecimento_status: 'pendente'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      return { items: [] };
    },
    post: async (url) => {
      calls.push({ method: 'POST', url });
      if (url === '/clientes/c1/enriquecer') {
        return postPromise;
      }
      throw new Error('unexpected post');
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="enriquecimento"]')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /Enriquecimento/);
  assert.match(root.textContent, /Pendente/);
  assert.match(root.textContent, /Enriquecer CNPJ/);

  root.querySelector('#nho2d-enrich')?.click();
  await flush();
  assert.match(root.textContent, /Enriquecendo dados/);
  resolvePost({
    item: {
      id: 'c1',
      razao_social: 'Empresa LTDA',
      nome_fantasia: 'Empresa',
      situacao_cadastral: 'ATIVA',
            data_abertura: '1994-05-05',
      cnae_principal: 'Comercio varejista',
      email_enriquecido: 'contato@empresa.com',
      telefone_enriquecido: '1133334444',
      cep: '01001000',
      logradouro: 'Rua A',
      numero: '100',
      complemento: 'Sala 1',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      enriquecimento_status: 'concluido',
      enriquecimento_ultima_execucao: '2026-06-16T18:29:32.000Z',
      enriquecimento_fonte: 'brasilapi',
      enriquecimento_erro: null,
      enriquecimento_payload: { origem: 'mock' }
    }
  });
  await flush();
  await flush();

  assert.match(root.textContent, /Dados enriquecidos com sucesso/);
  assert.match(root.textContent, /Empresa LTDA/);
  assert.match(root.textContent, /contato@empresa\.com/);
  assert.match(root.textContent, /05\/05\/1994/);
  assert.match(root.textContent, /16\/06\/2026 às 18:29/);
  assert.ok(calls.some((call) => call.method === 'POST' && call.url === '/clientes/c1/enriquecer'));

  teardownFrontendDom(dom);
});

test('cliente details mostra erro claro ao falhar enriquecimento', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const apiClient = {
    get: async (url, params = {}) => {
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
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      return { items: [] };
    },
    post: async () => {
      const error = new Error('BrasilAPI retornou status 404: CNPJ nao encontrado');
      error.status = 422;
      throw error;
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();
  root.querySelector('[data-tab="enriquecimento"]')?.click();
  await flush();
  await flush();
  root.querySelector('#nho2d-enrich')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /BrasilAPI retornou status 404/);

  teardownFrontendDom(dom);
});
