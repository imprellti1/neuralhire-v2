# RLS multi-tenant (clientes)

## Modelo de seguranca

O dominio `clientes-crm` aplica isolamento por `account_id` em duas camadas:
- API: validacao de tenant no request/contexto.
- Banco (Supabase): RLS obrigatoria por JWT.

## Claims JWT esperadas

`account_id` pode vir de:
- claim raiz `account_id`
- `app_metadata.account_id`
- `user_metadata.account_id`

A API tambem aceita `accountId` no contexto para compatibilidade interna.

## Helper `current_account_id()`

Migration cria `public.current_account_id()` para centralizar leitura de tenant no JWT com `auth.jwt()`.
Isso evita repeticao de expressao nas policies e reduz risco de divergencia.

## Policies RLS

Tabela: `public.clientes`

- SELECT: `account_id = current_account_id()` para `authenticated`
- INSERT: `account_id = current_account_id()` para `authenticated`
- UPDATE: somente linhas do tenant e mantendo tenant do JWT
- DELETE: somente linhas do tenant
- `service_role`: acesso total (backend confiavel)

## API + RLS juntos

Somente API nao basta (risco de bypass por credencial direta ao banco).
Somente RLS sem validacao de contexto piora DX e rastreabilidade.
As duas camadas juntas entregam seguranca e previsibilidade operacional.

## Riscos de bypass

Sem RLS, qualquer caminho alternativo ao repository pode vazar dados cross-tenant.
Sem tenant no contexto, requests autenticados nao devem acessar clientes.

## service_role

`service_role` permanece irrestrita para jobs/rotinas internas controladas.
Nao deve ser exposta ao cliente.

## Proximos passos

1. Propagar JWT real do Supabase em producao (sem headers de teste).
2. Auditar outros dominios para mesma estrategia de RLS por tenant.
3. Adicionar monitoramento de eventos `TENANT_REQUIRED` e tentativas cross-tenant.