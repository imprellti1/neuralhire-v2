-- ETAPA 12: endurecimento RLS multi-tenant para public.clientes
-- Esta migration reforca isolamento por account_id no banco, complementando a validacao da API.

-- Remove policies permissivas antigas da etapa inicial.
drop policy if exists "clientes_authenticated_all" on public.clientes;
drop policy if exists "clientes_service_role_all" on public.clientes;

-- Remove policies tenant anteriores para evitar duplicidade em reaplicacoes.
drop policy if exists "clientes_select_authenticated_tenant" on public.clientes;
drop policy if exists "clientes_insert_authenticated_tenant" on public.clientes;
drop policy if exists "clientes_update_authenticated_tenant" on public.clientes;
drop policy if exists "clientes_delete_authenticated_tenant" on public.clientes;
drop policy if exists "clientes_service_role_full_access" on public.clientes;

-- Helper central para resolver account_id do JWT do usuario autenticado.
-- A funcao e usada nas policies para manter a regra multi-tenant em um unico ponto.
create or replace function public.current_account_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() ->> 'account_id',
      auth.jwt() -> 'app_metadata' ->> 'account_id',
      auth.jwt() -> 'user_metadata' ->> 'account_id'
    ),
    ''
  )::uuid
$$;

alter table public.clientes enable row level security;

-- authenticated: leitura restrita ao tenant do JWT.
create policy "clientes_select_authenticated_tenant"
on public.clientes
for select
to authenticated
using (account_id = public.current_account_id());

-- authenticated: insercao permitida apenas no proprio tenant do JWT.
create policy "clientes_insert_authenticated_tenant"
on public.clientes
for insert
to authenticated
with check (account_id = public.current_account_id());

-- authenticated: update apenas em registros do proprio tenant.
create policy "clientes_update_authenticated_tenant"
on public.clientes
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

-- authenticated: delete apenas em registros do proprio tenant.
create policy "clientes_delete_authenticated_tenant"
on public.clientes
for delete
to authenticated
using (account_id = public.current_account_id());

-- service_role: acesso total para rotinas backend confiaveis.
create policy "clientes_service_role_full_access"
on public.clientes
for all
to service_role
using (true)
with check (true);

grant all on table public.clientes to authenticated;
grant all on table public.clientes to service_role;
