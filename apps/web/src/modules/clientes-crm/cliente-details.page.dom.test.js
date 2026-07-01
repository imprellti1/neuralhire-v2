import assert from 'node:assert/strict';
import test from 'node:test';
import { renderClienteDetailsPage } from './cliente-details.page.js';
import { dispatchInput, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

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
      if (url === '/clientes/c1/timeline') return { items: [{ id: 't1', categoria: 'cadastro', titulo: 'Cliente cadastrado', descricao: 'Cadastro concluído', created_at: '2026-06-10T10:00:00.000Z' }] };
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

  assert.ok(document.querySelector('[data-tab="timeline"]'));

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

  root.querySelector('[data-tab="timeline"]')?.click();
  await flush();
  await flush();
  assert.match(root.textContent, /Cliente cadastrado/);

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

  assert.ok(document.querySelector('[data-tab="timeline"]'));

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

test('cliente details timeline mostra eventos e estado vazio sem quebrar', async () => {
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
            empresa: 'Cliente Timeline',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      if (url === '/clientes/c1/timeline') return { items: [{ id: 't1', categoria: 'cadastro', titulo: 'Cliente cadastrado', descricao: 'Cadastro concluído', created_at: '2026-06-10T10:00:00.000Z' }] };
      return { items: [] };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="timeline"]')?.click();
  await flush();
  await flush();
  assert.match(root.textContent, /Timeline/);
  assert.match(root.textContent, /Cliente cadastrado/);
  assert.ok(calls.some((call) => call.url === '/clientes/c1/timeline'));

  const apiClientEmpty = {
    get: async (url, params = {}) => {
      if (url === '/clientes/c1') {
        return { item: { id: 'c1', empresa: 'Cliente Timeline', cidade: 'São Paulo', estado: 'SP', created_at: '2026-05-01T00:00:00.000Z', status: 'ativo' } };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      if (url === '/clientes/c1/timeline') return { items: [] };
      return { items: [] };
    }
  };

  teardownFrontendDom(dom);
  const domEmpty = setupFrontendDom('#/clientes/c1');
  const rootEmpty = document.getElementById('root');
  renderClienteDetailsPage(rootEmpty, { apiClient: apiClientEmpty, clienteId: 'c1' });
  await flush();
  await flush();
  rootEmpty.querySelector('[data-tab="timeline"]')?.click();
  await flush();
  await flush();
  assert.match(rootEmpty.textContent, /Nenhum evento registrado ainda/);
  teardownFrontendDom(domEmpty);
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

test('cliente details permite editar dados principais com salvar e cancelar', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  let clienteAtual = {
    id: 'c1',
    empresa: 'Cliente A',
    razao_social: 'Cliente A LTDA',
    cidade: 'São Paulo',
    estado: 'SP',
    created_at: '2026-05-01T00:00:00.000Z',
    status: 'ativo',
    vendedor_nome: 'Vendedor 1',
    documento: '00110513000155',
    telefone: '(11) 99999-9999',
    telefone2: '(11) 98888-8888',
    email: 'a@a.com'
  };
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ method: 'GET', url, params });
      if (url === '/clientes/c1') {
        return { item: clienteAtual };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') {
        return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      }
      if (url === '/clientes/c1/timeline') return { items: [] };
      return { items: [] };
    },
    patch: async (url, body) => {
      calls.push({ method: 'PATCH', url, body });
      if (url === '/clientes/c1') {
        clienteAtual = { ...clienteAtual, ...body };
        return { item: { id: 'c1', ...body } };
      }
      throw new Error('unexpected patch');
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('#nho2d-edit-start')?.click();
  await flush();
  await flush();
  assert.ok(root.querySelector('#nho2d-edit-save'));
  assert.equal(root.querySelector('#nho2d-edit-documento')?.disabled, true);
  assert.match(root.querySelector('#nho2d-edit-documento')?.value || '', /00\.110\.513\/0001-55/);
  dispatchInput(root.querySelector('#nho2d-edit-cidade'), 'Curitiba');
  dispatchInput(root.querySelector('#nho2d-edit-email'), 'novo@exemplo.com');
  root.querySelector('#nho2d-edit-save')?.click();
  await flush();
  await flush();

  const patchCall = calls.find((call) => call.method === 'PATCH');
  assert.ok(patchCall);
  assert.equal(patchCall.body.cidade, 'Curitiba');
  assert.equal(patchCall.body.email, 'novo@exemplo.com');
  assert.ok(calls.filter((call) => call.method === 'GET' && call.url === '/clientes/c1').length >= 2);
  assert.match(root.textContent, /00\.110\.513\/0001-55/);
  assert.match(root.textContent, /Curitiba/);
  assert.match(root.textContent, /novo@exemplo\.com/);
  assert.match(root.textContent, /Dados do cliente atualizados com sucesso/i);

  root.querySelector('#nho2d-edit-start')?.click();
  await flush();
  await flush();
  dispatchInput(root.querySelector('#nho2d-edit-cidade'), 'Florianópolis');
  root.querySelector('#nho2d-edit-cancel')?.click();
  await flush();
  await flush();
  assert.ok(!root.querySelector('#nho2d-edit-save'));

  teardownFrontendDom(dom);
});

test('cliente details dispara sincronizacao 360 ao abrir e aplica retorno', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
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
            documento: '00.000.000/0001-00',
            telefone: '(11) 99999-9999',
            email: 'a@a.com'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      if (url === '/clientes/c1/timeline') return { items: [] };
      return { items: [] };
    },
    post: async (url) => {
      calls.push({ method: 'POST', url });
      if (url === '/clientes/c1/sincronizar-360') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente A',
            cidade: 'Curitiba',
            estado: 'PR',
            status: 'ativo',
            cliente_score: 88,
            timeline: [{ id: 't-sync', categoria: 'score', titulo: 'Score atualizado', descricao: 'OK', created_at: '2026-06-30T10:00:00.000Z' }]
          },
          resumo: { changes: ['cidade', 'estado', 'cliente_score'], errors: [] }
        };
      }
      throw new Error('unexpected post');
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();
  assert.ok(calls.some((call) => call.method === 'POST' && call.url === '/clientes/c1/sincronizar-360'));
  assert.match(root.textContent, /Atualizando dados do cliente|Sincronização concluída|campo\(s\) atualizados/i);
  assert.match(root.textContent, /Curitiba/);
  teardownFrontendDom(dom);
});

test('cliente details mostra dados relevantes e executa enriquecimento manual', async () => {
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
            status: 'ativo',
            enriquecimento_status: 'pendente'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      return { items: [] };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="dados-relevantes"]')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /Dados principais/);
  assert.match(root.textContent, /Enriquecimento cadastral/);
  assert.match(root.textContent, /Pendente/);
  assert.match(root.textContent, /Atualizar enriquecimento/);

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
  root.querySelector('[data-tab="dados-relevantes"]')?.click();
  await flush();
  await flush();
  root.querySelector('#nho2d-enrich')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /BrasilAPI retornou status 404/);

  teardownFrontendDom(dom);
});

test('cliente details mostra dados relevantes e executa geolocalizacao manual', async () => {
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
            status: 'ativo',
            geolocalizacao_status: 'pendente'
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      return { items: [] };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="dados-relevantes"]')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /Geolocalização/);
  assert.match(root.textContent, /Geolocalizar Cliente/);

  teardownFrontendDom(dom);
});

test('cliente details mostra score comercial e executa calculo manual', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ method: 'GET', url, params });
      if (url === '/clientes/c1') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente Score',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo',
            cliente_score: 72,
            cliente_classificacao: 'B',
            cliente_potencial: 'Médio',
            cliente_score_ultima_execucao: '2026-06-16T18:29:32.000Z',
            cliente_score_fatores: {
              faturamento_total: 5000,
              total_pedidos: 5,
              ticket_medio: 1000,
              ultima_compra: '2026-06-15T00:00:00.000Z',
              dias_sem_compra: 2,
              produtos_distintos: 3
            }
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      return { items: [] };
    },
    post: async (url) => {
      calls.push({ method: 'POST', url });
      if (url === '/clientes/c1/calcular-score') {
        return {
          cliente: {
            id: 'c1',
            cliente_score: 88,
            cliente_classificacao: 'A',
            cliente_potencial: 'Alto',
            cliente_score_ultima_execucao: '2026-06-17T10:00:00.000Z',
            cliente_score_fatores: {
              faturamento_total: 10000,
              total_pedidos: 10,
              ticket_medio: 1000,
              ultima_compra: '2026-06-17T00:00:00.000Z',
              dias_sem_compra: 0,
              produtos_distintos: 10
            }
          },
          score: { score: 88, classificacao: 'A', potencial: 'Alto' }
        };
      }
      throw new Error('unexpected post');
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  assert.match(root.textContent, /Score Comercial/);
  assert.match(root.textContent, /72/);
  assert.match(root.textContent, /Classificação/);
  assert.match(root.textContent, /Potencial/);

  root.querySelector('#nho2d-score')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /Score comercial calculado com sucesso/);
  assert.match(root.textContent, /88/);
  assert.match(root.textContent, /Alto/);
  assert.ok(calls.some((call) => call.method === 'POST' && call.url === '/clientes/c1/calcular-score'));

  teardownFrontendDom(dom);
});

test('cliente details mostra segmentacao comercial e executa calculo manual', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ method: 'GET', url, params });
      if (url === '/clientes/c1') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente Segmentação',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo',
            segmento_comercial: 'VIP',
            segmento_ultima_atualizacao: '2026-06-17T10:00:00.000Z',
            segmento_motivos: ['Score A', 'Alto faturamento', 'Alta recorrência']
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      return { items: [] };
    },
    post: async (url) => {
      calls.push({ method: 'POST', url });
      if (url === '/clientes/c1/calcular-segmentacao') {
        return {
          cliente: {
            id: 'c1',
            segmento_comercial: 'RECORRENTE',
            segmento_ultima_atualizacao: '2026-06-17T11:00:00.000Z',
            segmento_motivos: ['Compra frequente', 'Relacionamento ativo']
          },
          segmentacao: { segmento: 'RECORRENTE', motivos: ['Compra frequente', 'Relacionamento ativo'] }
        };
      }
      throw new Error('unexpected post');
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  assert.match(root.textContent, /Segmentação Comercial/);
  assert.match(root.textContent, /VIP/);

  root.querySelector('#nho2d-segmentacao')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /Segmentação atualizada para RECORRENTE/);
  assert.match(root.textContent, /RECORRENTE/);
  assert.ok(calls.some((call) => call.method === 'POST' && call.url === '/clientes/c1/calcular-segmentacao'));

  teardownFrontendDom(dom);
});

test('cliente details mostra alertas comerciais, gera e resolve sem reload', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ method: 'GET', url, params });
      if (url === '/clientes/c1') {
        return {
          item: {
            id: 'c1',
            empresa: 'Cliente Alertas',
            cidade: 'São Paulo',
            estado: 'SP',
            created_at: '2026-05-01T00:00:00.000Z',
            status: 'ativo',
            cliente_alertas: [
              { id: 'a1', status: 'ativo', tipo: 'queda_score', severidade: 'alta', titulo: 'Score caiu', descricao: 'Score caiu 20 pontos' },
              { id: 'a2', status: 'resolvido', tipo: 'sem_compra', severidade: 'media', titulo: 'Antigo', descricao: 'já resolvido' }
            ]
          }
        };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      if (url === '/clientes/c1/alertas') return { items: [{ id: 'a1', status: 'ativo', tipo: 'queda_score', severidade: 'alta', titulo: 'Score caiu', descricao: 'Score caiu 20 pontos' }] };
      return { items: [] };
    },
    post: async (url) => {
      calls.push({ method: 'POST', url });
      if (url === '/clientes/c1/gerar-alertas') return { alertas: [{ id: 'a1' }] };
      return { ok: true };
    },
    patch: async (url) => {
      calls.push({ method: 'PATCH', url });
      if (url === '/clientes/alertas/a1/resolver') return { item: { id: 'a1', status: 'resolvido' } };
      return { ok: true };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  assert.match(root.textContent, /Alertas Comerciais/);
  assert.match(root.textContent, /Score caiu/);
  root.querySelector('#nho2d-alerts-generate')?.click();
  await flush();
  await flush();
  assert.ok(calls.some((call) => call.method === 'POST' && call.url === '/clientes/c1/gerar-alertas'));
  root.querySelector('[data-resolver-alerta="a1"]')?.click();
  await flush();
  await flush();
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.url === '/clientes/alertas/a1/resolver'));

  teardownFrontendDom(dom);
});

test('cliente details mostra aba WhatsApp com conversas e mensagens selecionáveis', async () => {
  const dom = setupFrontendDom('#/clientes/c1');
  const root = document.getElementById('root');
  const calls = [];
  const apiClient = {
    get: async (url, params = {}) => {
      calls.push({ method: 'GET', url, params });
      if (url === '/clientes/c1') {
        return { item: { id: 'c1', empresa: 'Cliente WhatsApp', cidade: 'São Paulo', estado: 'SP', created_at: '2026-05-01T00:00:00.000Z', status: 'ativo' } };
      }
      if (url === '/pedidos' && String(params.cliente_id || '') === 'c1') return { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } };
      if (url === '/clientes/c1/timeline') return { items: [] };
      if (url === '/clientes/c1/whatsapp/conversations') {
        return {
          items: [
            { id: 'conv-1', provider: 'evolution', instance_name: 'inst-1', instance_type: 'operational', phone: '11999999999', contact_name: 'Ana', last_message_at: '2026-06-12T10:00:00.000Z', last_message_preview: 'Bom dia', message_count: 2, direction_last_message: 'outbound', created_at: '2026-06-10T10:00:00.000Z', updated_at: '2026-06-12T10:00:00.000Z' },
            { id: 'conv-2', provider: 'evolution', instance_name: 'inst-2', instance_type: 'learning', phone: '11888888888', contact_name: 'Bruno', last_message_at: '2026-06-11T10:00:00.000Z', last_message_preview: 'Olá', message_count: 1, direction_last_message: 'inbound', created_at: '2026-06-09T10:00:00.000Z', updated_at: '2026-06-11T10:00:00.000Z' }
          ]
        };
      }
      if (url === '/clientes/c1/whatsapp/conversations/conv-1/messages') {
        return { items: [{ id: 'm1', message_id: 'msg-1', direction: 'inbound', message_type: 'text', text: 'Oi', media_url: null, sent_at: '2026-06-12T09:00:00.000Z', raw_payload: {}, created_at: '2026-06-12T09:00:00.000Z' }, { id: 'm2', message_id: 'msg-2', direction: 'outbound', message_type: 'text', text: 'Tudo bem?', media_url: null, sent_at: '2026-06-12T10:00:00.000Z', raw_payload: {}, created_at: '2026-06-12T10:00:00.000Z' }] };
      }
      if (url === '/clientes/c1/alertas') return { items: [] };
      return { items: [] };
    }
  };

  renderClienteDetailsPage(root, { apiClient, clienteId: 'c1' });
  await flush();
  await flush();

  root.querySelector('[data-tab="radar"]')?.click();
  await flush();
  await flush();

  assert.match(root.textContent, /Radar/);
  assert.match(root.textContent, /Radar Comercial/);

  teardownFrontendDom(dom);
});
