# Autenticação Supabase em Homologação

## Fluxo oficial
1. O usuário acessa `#/login`.
2. O frontend autentica via Supabase Auth.
3. A sessão é salva localmente no navegador.
4. O `api-client` envia `Authorization: Bearer <access_token>`.
5. A API valida o JWT no Supabase, resolve o usuário e identifica `accountId` e `role`.
6. A request segue com contexto autenticado e RLS real.

## Regras importantes
- Não depender de `VITE_DEMO_ACCOUNT_ID` em homologação.
- Não usar `x-test-account-id` nem `x-test-role` como fluxo principal.
- `x-test-*` fica somente para local e testes automatizados.
- Não enviar `account_id`, `tenant_id` ou `owner_user_id` no payload do frontend.

## Sessão no web
- Login: `#/login`
- Logout: `#/logout`
- Redirecionamento pós-login: `#/product-editor`

## Observações de API
- Rotas protegidas sem token retornam `401`.
- O `accountId` deve vir do JWT e da associação do usuário na conta.
- A validação de role deve vir do contexto autenticado.

## Deploy
- Redeploy da API após publicar `APP_ENV=homologation` e `AUTH_MODE=supabase`.
- Redeploy da WEB após publicar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
