import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchProdutoDetailsData } from './produto-details.service.js';

test('fetchProdutoDetailsData usa fallback de variacoes quando detalhe nao traz a lista', async () => {
  const calls = [];
  const apiClient = {
    async get(path) {
      calls.push(path);
      if (path === '/produtos/p1') {
        return { item: { id: 'p1', nome: 'Produto 850400255', sku: '850400255', categoria: 'Categoria', estoque: 0 } };
      }
      if (path === '/product-editor/products/p1') {
        return {
          item: {
            id: 'p1',
            nome: 'Produto 850400255',
            sku: '850400255',
            categoria: 'Categoria',
            variations: [
              { id: 'v1', sku: '850400255-1', cor: 'Azul', grade: 'P', estoque_atual: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' },
              { id: 'v2', sku: '850400255-2', cor: 'Azul', grade: 'M', estoqueAtual: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' },
              { id: 'v3', sku: '850400255-3', cor: 'Azul', grade: 'G', estoque: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' },
              { id: 'v4', sku: '850400255-4', cor: 'Azul', grade: 'GG', estoque: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' }
            ]
          }
        };
      }
      if (path === '/produtos/p1/variacoes') {
        return {
          items: [
            { id: 'v1', sku: '850400255-1', cor: 'Azul', grade: 'P', estoque_atual: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' },
            { id: 'v2', sku: '850400255-2', cor: 'Azul', grade: 'M', estoqueAtual: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' },
            { id: 'v3', sku: '850400255-3', cor: 'Azul', grade: 'G', estoque: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' },
            { id: 'v4', sku: '850400255-4', cor: 'Azul', grade: 'GG', estoque: 2, preco: 10, status: 'ativo', status_comercial: 'ativo', updated_at: '2026-05-01T00:00:00.000Z' }
          ]
        };
      }
      throw new Error(`unhandled ${path}`);
    }
  };

  const produto = await fetchProdutoDetailsData(apiClient, 'p1');
  assert.deepEqual(calls, ['/produtos/p1', '/produtos/p1/variacoes']);
  assert.equal(produto.variacoes.length, 4);
  assert.equal(produto.estoqueTotalVariacoes, 8);
  assert.equal(produto.variacoes[0].estoqueAtual, 2);
  assert.equal(produto.variacoes[0].cor, 'Azul');
  assert.equal(produto.variacoes[0].tamanho, 'P');
});

test('fetchProdutoDetailsData aceita resposta direta de product-editor com variations', async () => {
  const apiClient = {
    async get(path) {
      if (path === '/produtos/p2') {
        throw new Error('404');
      }
  if (path === '/product-editor/products/p2') {
        return {
          item: {
            id: 'p2',
            nome: 'Produto 2',
            sku: '850400256',
            categoria: 'Categoria',
            variations: [
              { id: 'v1', sku: '850400256-1', cor: 'Preto', tamanho: 'U', estoque_atual: 1, status_comercial: 'ativo' }
            ]
          }
        };
      }
      throw new Error(`unhandled ${path}`);
    }
  };

  const produto = await fetchProdutoDetailsData(apiClient, 'p2');
  assert.equal(produto.variacoes.length, 1);
  assert.equal(produto.estoqueTotalVariacoes, 1);
  assert.equal(produto.variacoes[0].statusComercial, 'ativo');
});

test('fetchProdutoDetailsData nao depende do endpoint product-editor/products/:id/variations', async () => {
  const calls = [];
  const apiClient = {
    async get(path) {
      calls.push(path);
      if (path === '/produtos/p3') {
        return { item: { id: 'p3', nome: 'Produto 3', sku: '850400257', categoria: 'Categoria', estoque: 0 } };
      }
      if (path === '/produtos/p3/variacoes') {
        return {
          items: [
            { id: 'v1', sku: '850400257-1', cor: 'Azul', grade: 'U', estoque_atual: 3, preco: 10, status: 'ativo', status_comercial: 'ativo' }
          ]
        };
      }
      throw new Error(`unhandled ${path}`);
    }
  };

  const produto = await fetchProdutoDetailsData(apiClient, 'p3');
  assert.deepEqual(calls, ['/produtos/p3', '/produtos/p3/variacoes']);
  assert.equal(produto.variacoes.length, 1);
  assert.equal(produto.variacoes[0].sku, '850400257-1');
});
