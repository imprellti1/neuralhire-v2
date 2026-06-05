import { requirePermission, requireRole } from '../../core/rbac.middleware.js';
import { normalizeRole } from '../../core/permissions.js';
import { createTestContext } from '../create-test-context.js';
import { assertEqual } from '../assert.js';

export function getRbacTests() {
  return [
    {
      name: 'normalizeRole reconhece owner',
      run: async () => {
        assertEqual(normalizeRole('owner'), 'owner', 'owner deve permanecer owner');
      }
    },
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
      name: 'owner passa em produtos:read',
      run: async () => {
        const middleware = requirePermission('produtos:read');
        const context = createTestContext({ auth: { authenticated: true, role: 'owner', tokenPresent: true } });
        const result = await middleware({}, {}, context);
        assertEqual(result, true, 'Owner deveria passar em produtos:read');
      }
    },
    {
      name: 'owner passa em fabricantes:read',
      run: async () => {
        const middleware = requirePermission('fabricantes:read');
        const context = createTestContext({ auth: { authenticated: true, role: 'owner', tokenPresent: true } });
        const result = await middleware({}, {}, context);
        assertEqual(result, true, 'Owner deveria passar em fabricantes:read');
      }
    },
    {
      name: 'owner passa em fabricantes:write',
      run: async () => {
        const middleware = requirePermission('fabricantes:write');
        const context = createTestContext({ auth: { authenticated: true, role: 'owner', tokenPresent: true } });
        const result = await middleware({}, {}, context);
        assertEqual(result, true, 'Owner deveria passar em fabricantes:write');
      }
    },
    {
      name: 'owner passa em admin-only',
      run: async () => {
        const middleware = requireRole('admin');
        const context = createTestContext({ auth: { authenticated: true, role: 'owner', tokenPresent: true } });
        const result = await middleware({}, {}, context);
        assertEqual(result, true, 'Owner deveria passar em permissao administrativa');
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
      name: 'role desconhecida cai para user',
      run: async () => {
        assertEqual(normalizeRole('qualquer_coisa'), 'user', 'Role desconhecida deve cair para user');
      }
    },
    {
      name: 'user bloqueia fabricantes:read',
      run: async () => {
        const middleware = requirePermission('fabricantes:read');
        const context = createTestContext({ auth: { authenticated: true, role: 'user', tokenPresent: true } });
        let code = null;
        try {
          await middleware({}, {}, context);
        } catch (error) {
          code = error.code;
          assertEqual(error.statusCode, 403, 'Status esperado 403');
        }
        assertEqual(code, 'FORBIDDEN_PERMISSION', 'User deve ser bloqueado');
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
