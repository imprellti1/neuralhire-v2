import { requireRole } from '../../core/rbac.middleware.js';
import { createTestContext } from '../create-test-context.js';
import { assertEqual } from '../assert.js';

export function getRbacTests() {
  return [
    {
      name: 'role user em admin-only retorna 403',
      run: async () => {
        const middleware = requireRole('admin');
        const context = createTestContext({ auth: { authenticated: true, role: 'user', tokenPresent: true } });
        let code = null;
        try {
          await middleware({}, {}, context);
        } catch (error) {
          code = error.code;
          assertEqual(error.statusCode, 403, 'Status esperado 403');
        }
        assertEqual(code, 'FORBIDDEN_ROLE', 'Code esperado FORBIDDEN_ROLE');
      }
    },
    {
      name: 'role admin em admin-only retorna sucesso',
      run: async () => {
        const middleware = requireRole('admin');
        const context = createTestContext({ auth: { authenticated: true, role: 'admin', tokenPresent: true } });
        const result = await middleware({}, {}, context);
        assertEqual(result, true, 'Admin deveria passar');
      }
    },
    {
      name: 'role super_admin em admin-only retorna sucesso',
      run: async () => {
        const middleware = requireRole('admin');
        const context = createTestContext({ auth: { authenticated: true, role: 'super_admin', tokenPresent: true } });
        const result = await middleware({}, {}, context);
        assertEqual(result, true, 'Super admin deveria passar');
      }
    }
  ];
}
