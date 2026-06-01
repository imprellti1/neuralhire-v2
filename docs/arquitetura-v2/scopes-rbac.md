# Scopes e RBAC

## Modelo
Permissao segue padrao `dominio:acao`.
Exemplos:
- `clientes:read`
- `clientes:write`
- `system:admin`

## ROLE_PERMISSIONS
Cada role recebe uma lista explicita de escopos.
`super_admin` usa `*` para acesso total.

## requirePermission
Middleware por escopo:
- exige autenticacao valida
- verifica permissao por role
- em falha: `403 FORBIDDEN_PERMISSION`

## Matriz por rota
Arquivo central: `src/core/route-permissions.js`.
Cada rota declara `public`, `authenticated`, `role` e/ou `permission`.

## Exemplo
`POST /clientes` => `authenticated: true` + `permission: clientes:write`.
