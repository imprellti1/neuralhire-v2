import { assertEqual } from '../assert.js';
import { __resetMemoryProdutosForTests, createProduto, listProdutos } from '../../modules/produtos/produtos.repository.js';

const accountId = 'acc-prod-pagination';

export function getProdutosPaginationTests() {
  return [
    {
      name: 'produtos limit default 20',
      run: async () => {
        __resetMemoryProdutosForTests();
        const result = await listProdutos({}, { accountId });
        assertEqual(result.limit, 20);
      }
    },
    {
      name: 'produtos limit max 100',
      run: async () => {
        __resetMemoryProdutosForTests();
        const result = await listProdutos({ limit: 999 }, { accountId });
        assertEqual(result.limit, 100);
      }
    },
    {
      name: 'produtos totalPages calculado',
      run: async () => {
        __resetMemoryProdutosForTests();
        await createProduto({ nome: 'P1' }, { accountId });
        await createProduto({ nome: 'P2' }, { accountId });
        await createProduto({ nome: 'P3' }, { accountId });
        const result = await listProdutos({ page: 1, limit: 2 }, { accountId });
        assertEqual(result.totalPages, 2);
      }
    },
    {
      name: 'produtos filtros categoria/marca/ativo',
      run: async () => {
        __resetMemoryProdutosForTests();
        await createProduto({ nome: 'A', categoria: 'banho', marca: 'Appel', ativo: true }, { accountId });
        await createProduto({ nome: 'B', categoria: 'cama', marca: 'Outra', ativo: false }, { accountId });
        const result = await listProdutos({ categoria: 'banho', marca: 'Appel', ativo: true }, { accountId });
        assertEqual(result.total, 1);
      }
    }
  ];
}