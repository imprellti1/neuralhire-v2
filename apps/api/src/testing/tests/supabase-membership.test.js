import { authContextMiddleware } from '../../core/auth-context.middleware.js';
import { env } from '../../config/env.js';
import { resolveAccountMembership } from '../../database/supabase.client.js';
import { createTestContext } from '../create-test-context.js';
import { assertEqual } from '../assert.js';

function createSupabaseStub(recordsByTableAndColumn) {
  return {
    from(table) {
      const state = { table, column: null, value: null };
      return {
        select() {
          return this;
        },
        eq(column, value) {
          state.column = column;
          state.value = value;
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          const key = `${state.table}:${state.column}:${state.value}`;
          const data = recordsByTableAndColumn[key] || null;
          return { data, error: null };
        }
      };
    }
  };
}

export function getSupabaseMembershipTests() {
  return [
    {
      name: 'resolveAccountMembership prioriza auth_user_id',
      run: async () => {
        const supabase = createSupabaseStub({
          'account_users:auth_user_id:7dfcb407-28ed-42b0-92da-ca2b25b8675c': {
            account_id: 'acc-1',
            role: 'owner',
            email: 'imprell.ti1@gmail.com',
            auth_user_id: '7dfcb407-28ed-42b0-92da-ca2b25b8675c'
          }
        });

        const membership = await resolveAccountMembership(supabase, '7dfcb407-28ed-42b0-92da-ca2b25b8675c', 'imprell.ti1@gmail.com');
        assertEqual(membership.account_id, 'acc-1', 'Deve resolver account_id');
        assertEqual(membership.role, 'owner', 'Deve resolver role owner');
        assertEqual(membership.auth_user_id, '7dfcb407-28ed-42b0-92da-ca2b25b8675c', 'Deve preservar auth_user_id');
      }
    },
    {
      name: 'resolveAccountMembership usa fallback por email',
      run: async () => {
        const supabase = createSupabaseStub({
          'account_users:email:imprell.ti1@gmail.com': {
            account_id: 'acc-2',
            role: 'owner',
            email: 'imprell.ti1@gmail.com',
            auth_user_id: null
          }
        });

        const membership = await resolveAccountMembership(supabase, 'missing-user-id', 'imprell.ti1@gmail.com');
        assertEqual(membership.account_id, 'acc-2', 'Deve resolver por email');
        assertEqual(membership.role, 'owner', 'Deve resolver role por email');
      }
    },
    {
      name: 'resolveAccountMembership retorna null sem membership',
      run: async () => {
        const supabase = createSupabaseStub({});
        const membership = await resolveAccountMembership(supabase, 'missing-user-id', 'missing@example.com');
        assertEqual(membership, null, 'Sem membership deve retornar null');
      }
    },
    {
      name: 'AUTH_MODE supabase bloqueia x-test headers',
      run: async () => {
        const previousAuthMode = env.AUTH_MODE;
        env.AUTH_MODE = 'supabase';

        try {
          const middleware = authContextMiddleware();
          const context = createTestContext();
          const req = {
            headers: {
              authorization: 'Bearer token-real',
              'x-test-role': 'admin'
            }
          };
          const res = {};
          await middleware(req, res, context);
          assertEqual(context.auth.authError, 'TEST_HEADERS_DISABLED', 'x-test-* deve ser bloqueado em supabase');
        } finally {
          env.AUTH_MODE = previousAuthMode;
        }
      }
    }
  ];
}
