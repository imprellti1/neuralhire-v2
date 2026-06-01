import { assertEqual } from '../assert.js';
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
        const item = await createProduto({ nome: 'Produto A', sku: 'A-1' }, { accountId });
        assertEqual(Boolean(item.id), true);
        assertEqual(item.account_id, accountId);
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
      name: 'getProdutoById funciona',
      run: async () => {
        __resetMemoryProdutosForTests();
        const created = await createProduto({ nome: 'Produto ID' }, { accountId });
        const found = await getProdutoById(created.id, { accountId });
        assertEqual(found.id, created.id);
      }
    }
  ];
}