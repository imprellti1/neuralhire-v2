import { assertEqual } from '../assert.js';
import {
  __resetMemoryClientesForTests,
  createCliente,
  listClientes
} from '../../modules/clientes/clientes.repository.js';

const accountId = 'acc-pagination-tests';

export function getClientesPaginationTests() {
  return [
    {
      name: 'limit default 20',
      run: async () => {
        __resetMemoryClientesForTests();
        const result = await listClientes({}, { accountId });
        assertEqual(result.limit, 20, 'limit default deve ser 20');
      }
    },
    {
      name: 'max limit 100',
      run: async () => {
        __resetMemoryClientesForTests();
        const result = await listClientes({ limit: 1000 }, { accountId });
        assertEqual(result.limit, 100, 'limit max deve ser 100');
      }
    },
    {
      name: 'page calculada corretamente',
      run: async () => {
        __resetMemoryClientesForTests();
        await createCliente({ nome: 'Cliente 1' }, { accountId });
        await createCliente({ nome: 'Cliente 2' }, { accountId });
        await createCliente({ nome: 'Cliente 3' }, { accountId });
        const result = await listClientes({ page: 2, limit: 2 }, { accountId });
        assertEqual(result.items.length, 1, 'segunda pagina com 1 item esperado');
        assertEqual(result.page, 2, 'page deve permanecer 2');
      }
    },
    {
      name: 'totalPages calculado',
      run: async () => {
        __resetMemoryClientesForTests();
        await createCliente({ nome: 'C1' }, { accountId });
        await createCliente({ nome: 'C2' }, { accountId });
        await createCliente({ nome: 'C3' }, { accountId });
        const result = await listClientes({ page: 1, limit: 2 }, { accountId });
        assertEqual(result.totalPages, 2, 'totalPages deve ser 2');
      }
    },
    {
      name: 'search filter por nome',
      run: async () => {
        __resetMemoryClientesForTests();
        await createCliente({ nome: 'Loja Exemplo' }, { accountId });
        await createCliente({ nome: 'Outro Cliente' }, { accountId });
        const result = await listClientes({ search: 'Loja' }, { accountId });
        assertEqual(result.total, 1, 'search deveria retornar 1 item');
      }
    }
  ];
}