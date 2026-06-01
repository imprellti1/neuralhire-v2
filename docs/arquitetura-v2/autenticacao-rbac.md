# Autenticacao e RBAC Inicial

## Fluxo de autenticacao
- A API le `Authorization: Bearer <token>` em middleware global.
- Sem token: contexto anonimo.
- Com token: tenta validar via `supabase.auth.getUser(token)`.

## Bearer token
- Formato aceito: `Bearer <jwt>`.
- Token nunca e logado ou retornado na resposta.

## context.auth
Estrutura atual:
- authenticated
- tokenPresent
- userId
- email
- role
- accountId
- source
- authError (quando aplicavel)

## requireAuth
- Middleware de protecao basica.
- Sem autenticacao valida: `401` com `AUTH_REQUIRED`.

## requireRole
- Middleware RBAC por hierarquia.
- Se role insuficiente: `403` com `FORBIDDEN_ROLE`.

## Hierarquia de roles
- super_admin (100)
- admin (80)
- manager (60)
- sales (40)
- viewer (20)
- user (10)

## Como proteger rota
Exemplo:
- `middlewares: [requireAuth(), requireRole('admin')]`

## Quando Supabase nao esta configurado
- Middleware nao quebra a API em development.
- `context.auth.authenticated` permanece false.
- `authError` recebe `SUPABASE_NOT_CONFIGURED`.

## Proximos passos
- Integrar emissao de tokens no frontend/login.
- Adicionar mapeamento de permissoes por recurso/acao.
- Persistir trilha de auditoria para eventos de seguranca.
