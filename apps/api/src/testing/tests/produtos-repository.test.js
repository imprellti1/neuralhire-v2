import { assertEqual } from '../assert.js';
import { Buffer } from 'node:buffer';
import { __resetMemoryFabricantesForTests, createFabricante } from '../../modules/fabricantes/fabricantes.repository.js';
import {
  __resetMemoryProdutosForTests,
  __loadMemoryProdutos,
  __normalizeProdutoUpdatePayloadForTests,
  createProduto,
  getProdutoById,
  getProdutosRepositoryMode,
  listProdutos,
  updateProdutoVariacaoImagem
} from '../../modules/produtos/produtos.repository.js';

const accountId = 'acc-prod-repo';

function createSupabaseMock() {
  return {
    storage: {}
  };
}

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
      name: 'updateProduto normaliza payload para Supabase',
      run: async () => {
        const payload = __normalizeProdutoUpdatePayloadForTests({
          nome: 'Produto X',
          fabricante_id: 'fab-1',
          fabricanteId: 'fab-1',
          status: 'ativo',
          imagemUrl: 'https://img.example/x.png',
          imagem_url: 'https://img.example/x.png',
          image_url: 'https://img.example/x.png',
          foto: 'https://img.example/x.png',
          foto_url: 'https://img.example/x.png',
          descricao: 'Desc'
        });
        assertEqual(payload.fabricante_id, 'fab-1');
        assertEqual(Object.prototype.hasOwnProperty.call(payload, 'fabricanteId'), false);
        assertEqual(Object.prototype.hasOwnProperty.call(payload, 'status'), false);
        assertEqual(Object.prototype.hasOwnProperty.call(payload, 'imagemUrl'), false);
        assertEqual(Object.prototype.hasOwnProperty.call(payload, 'image_url'), false);
        assertEqual(Object.prototype.hasOwnProperty.call(payload, 'foto'), false);
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
    },
    {
      name: 'updateProdutoVariacaoImagem salva imagem da variacao com tenant',
      run: async () => {
        __resetMemoryProdutosForTests();
        const produtoId = 'prod-1';
        const variacaoId = 'var-1';
        __loadMemoryProdutos([{ id: produtoId, account_id: accountId, nome: 'Produto 1', variacoes: [{ id: variacaoId, account_id: accountId, produto_id: produtoId, imagem_url: null, imagem_path: null, ativo: true, sku: 'SKU-1', nome: 'Variação 1', valor: 0, cor: 'Azul', grade: 'G' }] }]);
        const updated = await updateProdutoVariacaoImagem(produtoId, variacaoId, { fileName: 'foto.png', mimeType: 'image/png', base64: Buffer.from('fakepng').toString('base64'), size: 7 }, { accountId });
        assertEqual(Boolean(updated.imagem_url), true);
        assertEqual(updated.imagem_path.includes(`${accountId}/${produtoId}/${variacaoId}/`), true);
      }
    }
  ];
}
