# Permissoes por Rota

## Matriz declarativa
Arquivo central: `src/core/route-permissions.js`.

Exemplos:
- `GET /health` => publico
- `GET /system/protected` => autenticado
- `GET /system/admin-only` => autenticado + role admin

## Regras
- `public: true` libera acesso
- `authenticated: true` exige `requireAuth`
- `role: "admin"` aplica `requireRole("admin")`

## Enforce centralizado
`enforceRoutePermission(method, path)` roda no `router.resolve` antes dos middlewares de rota.

## Padrao futuro
Cada novo modulo deve incluir suas rotas na matriz para manter autorizacao rastreavel e auditavel.
