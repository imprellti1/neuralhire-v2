import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertEqual } from '../assert.js';
import { getSupabaseAuthContext } from '../../database/supabase.client.js';
import {
  __resetMemoryClientesForTests,
  createCliente,
  listClientes
} from '../../modules/clientes/clientes.repository.js';

export function getClientesRlsContractTests() {
  return [
    {
      name: 'repository exige accountId',
      run: async () => {
        __resetMemoryClientesForTests();
        let thrown = false;
        try {
          await listClientes({});
        } catch (error) {
          thrown = true;
          assertEqual(error.code, 'TENANT_REQUIRED', 'deve exigir tenant');
        }
        assertEqual(thrown, true, 'erro esperado sem accountId');
      }
    },
    {
      name: 'filtro account_id aplicado na listagem memory',
      run: async () => {
        __resetMemoryClientesForTests();
        await createCliente({ nome: 'A1' }, { accountId: 'acc-a' });
        await createCliente({ nome: 'B1' }, { accountId: 'acc-b' });
        const result = await listClientes({}, { accountId: 'acc-a' });
        assertEqual(result.items.every((i) => i.account_id === 'acc-a'), true, 'somente tenant acc-a');
      }
    },
    {
      name: 'createCliente sempre forca account_id do contexto',
      run: async () => {
        __resetMemoryClientesForTests();
        const item = await createCliente({ nome: 'X', account_id: 'malicioso' }, { accountId: 'acc-safe' });
        assertEqual(item.account_id, 'acc-safe', 'deve usar accountId do contexto');
      }
    },
    {
      name: 'helper getSupabaseAuthContext funciona',
      run: async () => {
        const auth = getSupabaseAuthContext({ auth: { accountId: 'acc-1', role: 'admin', userId: 'u-1' } });
        assertEqual(auth.accountId, 'acc-1');
        assertEqual(auth.role, 'admin');
        assertEqual(auth.userId, 'u-1');
      }
    },
    {
      name: 'migration documenta current_account_id e policies RLS',
      run: async () => {
        const filePath = join(process.cwd(), '..', '..', 'packages', 'database', 'supabase', 'migrations', '20260528_harden_clientes_rls.sql');
        const sql = readFileSync(filePath, 'utf8');
        assertEqual(sql.includes('current_account_id'), true, 'deve ter helper current_account_id');
        assertEqual(sql.includes('ENABLE ROW LEVEL SECURITY') || sql.includes('enable row level security'), true, 'deve habilitar RLS');
        assertEqual(sql.includes('create policy') || sql.includes('CREATE POLICY'), true, 'deve criar policies');
        assertEqual(sql.includes('auth.jwt'), true, 'deve usar auth.jwt');
      }
    }
  ];
}