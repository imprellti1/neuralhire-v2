# Clientes CRM com Supabase + fallback

## Tabela `public.clientes`

Migration: `packages/database/supabase/migrations/20260528_create_clientes_table.sql`

Campos principais:
- `id` UUID PK com `gen_random_uuid()`
- `account_id` UUID nullable
- dados de contato: `nome`, `documento`, `email`, `telefone`, `cidade`, `estado`
- `tags` (`text[]`) com default vazio
- `ativo` boolean com default `true`
- `metadata` (`jsonb`) com default `{}`
- `created_at` e `updated_at`

Indices:
- `account_id`
- `documento`
- `email`
- `created_at desc`

`updated_at`:
- function `public.set_updated_at()`
- trigger `trg_clientes_set_updated_at` em `before update`

## RLS e grants obrigatorios

A migration aplica:
- `GRANT ALL ON TABLE public.clientes TO authenticated`
- `GRANT ALL ON TABLE public.clientes TO service_role`
- grants de sequences no schema `public` para `authenticated` e `service_role`
- `ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY`
- policies basicas permissivas:
  - `clientes_authenticated_all` (`authenticated`, `FOR ALL`)
  - `clientes_service_role_all` (`service_role`, `FOR ALL`)

## Repository mode

Arquivo: `apps/api/src/modules/clientes/clientes.repository.js`

`getClientesRepositoryMode()` retorna:
- `mode`: `supabase` quando configurado, `memory` caso contrario
- `supabaseConfigured`: boolean

## Fallback memory

Sem `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, o modulo opera em memoria.
Isso garante funcionamento em dev/test sem dependencia externa.

## Paginacao e filtros

`listClientes(filters)` retorna:
- `items`
- `total`
- `page` (default 1)
- `limit` (default 20, max 100)
- `totalPages`

Filtros suportados:
- `search`: busca parcial em `nome`, `email`, `documento`
- `ativo`: boolean
- `account_id`: preparado para contexto futuro

## Proximos passos

1. Propagar `account_id` real do contexto de autenticacao.
2. Substituir policy permissiva por policy multi-tenant com RLS por conta.
3. Integrar frontend do modulo clientes consumindo contrato de paginacao/filtros.