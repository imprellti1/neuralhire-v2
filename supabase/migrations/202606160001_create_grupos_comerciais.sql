create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.grupos_comerciais (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  nome text not null,
  descricao text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grupo_comercial_clientes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  grupo_comercial_id uuid not null references public.grupos_comerciais(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(account_id, grupo_comercial_id, cliente_id)
);

create index if not exists idx_grupos_comerciais_account_id on public.grupos_comerciais (account_id);
create index if not exists idx_grupos_comerciais_ativo on public.grupos_comerciais (account_id, ativo);
create index if not exists idx_grupo_comercial_clientes_account_id on public.grupo_comercial_clientes (account_id);
create index if not exists idx_grupo_comercial_clientes_grupo_comercial_id on public.grupo_comercial_clientes (grupo_comercial_id);
create index if not exists idx_grupo_comercial_clientes_cliente_id on public.grupo_comercial_clientes (cliente_id);

drop trigger if exists trg_grupos_comerciais_set_updated_at on public.grupos_comerciais;
create trigger trg_grupos_comerciais_set_updated_at
before update on public.grupos_comerciais
for each row
execute function public.set_updated_at();

grant all on table public.grupos_comerciais to authenticated;
grant all on table public.grupos_comerciais to service_role;
grant all on table public.grupo_comercial_clientes to authenticated;
grant all on table public.grupo_comercial_clientes to service_role;

alter table public.grupos_comerciais enable row level security;
alter table public.grupo_comercial_clientes enable row level security;

drop policy if exists "grupos_comerciais_authenticated_all" on public.grupos_comerciais;
create policy "grupos_comerciais_authenticated_all"
on public.grupos_comerciais
for all
to authenticated
using (true)
with check (true);

drop policy if exists "grupos_comerciais_service_role_all" on public.grupos_comerciais;
create policy "grupos_comerciais_service_role_all"
on public.grupos_comerciais
for all
to service_role
using (true)
with check (true);

drop policy if exists "grupo_comercial_clientes_authenticated_all" on public.grupo_comercial_clientes;
create policy "grupo_comercial_clientes_authenticated_all"
on public.grupo_comercial_clientes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "grupo_comercial_clientes_service_role_all" on public.grupo_comercial_clientes;
create policy "grupo_comercial_clientes_service_role_all"
on public.grupo_comercial_clientes
for all
to service_role
using (true)
with check (true);
