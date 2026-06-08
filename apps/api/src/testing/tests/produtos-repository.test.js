import { assertEqual } from '../assert.js';
import { __resetMemoryFabricantesForTests, createFabricante } from '../../modules/fabricantes/fabricantes.repository.js';
import {
  __resetMemoryProdutosForTests,
  createProduto,
  getProdutoById,
  getProdutosRepositoryMode,
  listProdutos
} from '../../modules/produtos/produtos.repository.js';

const accountId = 'acc-prod-repo';

export function getProdutosRepositoryTests() {
  return [
    {
      name: 'produtos memory mode quando Supabase ausente',
      run: async () => {
        const mode = getProdutosRepositoryMode();
        assertEqual(mode.mode, 'memory');
      }
    },
    {
      name: 'createProduto cria item',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryFabricantesForTests();
        const item = await createProduto({ nome: 'Produto A', sku: 'A-1' }, { accountId });
        assertEqual(Boolean(item.id), true);
        assertEqual(item.account_id, accountId);
      }
    },
    {
      name: 'createProduto aceita fabricante valido',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryFabricantesForTests();
        const fabricante = await createFabricante({ nome: 'Fab A', cnpj: '12345678000199' }, { accountId });
        const item = await createProduto({ nome: 'Produto F', fabricante_id: fabricante.id }, { accountId });
        assertEqual(item.fabricante_id, fabricante.id);
        assertEqual(item.fabricante_nome, 'Fab A');
      }
    },
    {
      name: 'listProdutos com paginacao',
      run: async () => {
        __resetMemoryProdutosForTests();
        await createProduto({ nome: 'P1' }, { accountId });
        await createProduto({ nome: 'P2' }, { accountId });
        const result = await listProdutos({ page: 1, limit: 1 }, { accountId });
        assertEqual(result.items.length, 1);
        assertEqual(result.total, 2);
      }
    },
    {
      name: 'listProdutos retorna fabricante_nome',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryFabricantesForTests();
        const fabricante = await createFabricante({ nome: 'Fab Lista', cnpj: '22345678000199' }, { accountId });
        await createProduto({ nome: 'P1', fabricante_id: fabricante.id }, { accountId });
        const result = await listProdutos({ page: 1, limit: 10 }, { accountId });
        assertEqual(result.items[0].fabricante_nome, 'Fab Lista');
      }
    },
    {
      name: 'getProdutoById funciona',
      run: async () => {
        __resetMemoryProdutosForTests();
        const created = await createProduto({ nome: 'Produto ID' }, { accountId });
        const found = await getProdutoById(created.id, { accountId });
        assertEqual(found.id, created.id);
      }
    },
    {
      name: 'getProdutoById retorna regras herdadas',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryFabricantesForTests();
        const fabricante = await createFabricante({ nome: 'Fab Detalhe', cnpj: '62345678000199', comissao_padrao_percentual: 7, pedido_minimo_valor: 150, valor_minimo_duplicata: 250, aceita_bonificacao: true, aceita_consignacao: false, condicoes_pagamento: [{ prazo: '30/60' }] }, { accountId });
        const created = await createProduto({ nome: 'Produto Detalhe', fabricante_id: fabricante.id }, { accountId });
        const found = await getProdutoById(created.id, { accountId });
        assertEqual(found.regras_comerciais_fabricante.comissao_padrao, 7);
        assertEqual(found.regras_comerciais_fabricante.cnpj, '62345678000199');
      }
    }
  ];
}
