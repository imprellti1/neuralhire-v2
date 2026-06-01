import { assertEqual } from '../assert.js';
import {
  __resetMemoryClientesForTests,
  createCliente,
  getClientesRepositoryMode,
  listClientes
} from '../../modules/clientes/clientes.repository.js';

const accountId = 'acc-repo-tests';

export function getClientesRepositoryTests() {
  return [
    {
      name: 'modo memory quando Supabase ausente',
      run: async () => {
        const mode = getClientesRepositoryMode();
        assertEqual(mode.mode, 'memory', 'mode esperado memory sem configuracao');
      }
    },
    {
      name: 'createCliente memory cria item',
      run: async () => {
        __resetMemoryClientesForTests();
        const created = await createCliente({ nome: 'Loja Teste', email: 'teste@loja.com' }, { accountId });
        assertEqual(Boolean(created.id), true, 'id esperado');
        assertEqual(created.nome, 'Loja Teste', 'nome esperado');
      }
    },
    {
      name: 'listClientes retorna paginacao',
      run: async () => {
        __resetMemoryClientesForTests();
        await createCliente({ nome: 'A' }, { accountId });
        await createCliente({ nome: 'B' }, { accountId });
        const result = await listClientes({ page: 1, limit: 1 }, { accountId });
        assertEqual(result.page, 1, 'page esperado');
        assertEqual(result.limit, 1, 'limit esperado');
        assertEqual(result.items.length, 1, 'um item esperado');
        assertEqual(result.total, 2, 'total esperado');
      }
    },
    {
      name: 'filtros basicos ativo e search',
      run: async () => {
        __resetMemoryClientesForTests();
        await createCliente({ nome: 'Loja Ativa', ativo: true, email: 'ativa@x.com' }, { accountId });
        await createCliente({ nome: 'Loja Inativa', ativo: false, email: 'inativa@x.com' }, { accountId });

        const onlyActive = await listClientes({ ativo: true }, { accountId });
        assertEqual(onlyActive.total, 1, 'somente 1 ativo esperado');

        const bySearch = await listClientes({ search: 'inativa@x.com' }, { accountId });
        assertEqual(bySearch.total, 1, 'search deveria filtrar email');
      }
    }
  ];
}