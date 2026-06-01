# Multi-tenant no dominio clientes-crm

## Origem do `account_id`

`context.auth.accountId` e resolvido em ordem:
1. `user.app_metadata.account_id`
2. `user.app_metadata.accountId`
3. `user.user_metadata.account_id`
4. `user.user_metadata.accountId`
5. `x-test-account-id` (somente fora de production)
6. fallback `null`

## JWT claims esperadas

Claims de tenant devem estar em `app_metadata` ou `user_metadata` com chaves `account_id` ou `accountId`.

## Headers mock (nao production)

Permitidos apenas quando `NODE_ENV !== "production"`:
- `x-test-role`
- `x-test-account-id`

## tenantRequired por rota

Em `route-permissions`:
- `GET /clientes` exige `authenticated`, `clientes:read`, `tenantRequired: true`
- `POST /clientes` exige `authenticated`, `clientes:write`, `tenantRequired: true`

## Fluxo de enforcement

`enforceRoutePermission` aplica na ordem:
1. autenticacao
2. role (quando existir)
3. permission
4. tenant (`requireTenant`)

Sem `accountId`, retorna `403` com `TENANT_REQUIRED`.

## Repository e isolamento

`clientes.repository` sempre recebe `options.accountId`.

Regras:
- listagem sempre filtra por `account_id`
- criacao sempre grava `account_id` do contexto
- body nunca define tenant
- sem tenant => erro `TENANT_REQUIRED`

## RLS futura

Este isolamento em aplicacao prepara migracao para RLS estrita por tenant no banco.

## Riscos se faltar accountId

Sem `accountId` validado, ha risco de vazamento cross-tenant.
Por isso as rotas sensiveis exigem tenant antes de chamar handlers.