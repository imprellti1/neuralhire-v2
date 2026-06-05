-- ETAPA 13: cria tabela produtos com isolamento multi-tenant por account_id

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

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  codigo text null,
  sku text null,
  nome text not null,
  descricao text null,
  categoria text null,
  marca text null,
  ean text null,
  ncm text null,
  preco numeric(12,2) not null default 0,
  custo numeric(12,2) null,
  estoque numeric(12,3) not null default 0,
  unidade text not null default 'UN',
  ativo boolean not null default true,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produtos_account_id on public.produtos (account_id);
create index if not exists idx_produtos_sku on public.produtos (sku);
create index if not exists idx_produtos_codigo on public.produtos (codigo);
create index if not exists idx_produtos_categoria on public.produtos (categoria);
create index if not exists idx_produtos_marca on public.produtos (marca);
create index if not exists idx_produtos_ativo on public.produtos (ativo);
create index if not exists idx_produtos_created_at_desc on public.produtos (created_at desc);

drop trigger if exists trg_produtos_set_updated_at on public.produtos;
create trigger trg_produtos_set_updated_at
before update on public.produtos
for each row
execute function public.set_updated_at();

alter table public.produtos enable row level security;

drop policy if exists "produtos_select_authenticated_tenant" on public.produtos;
create policy "produtos_select_authenticated_tenant"
on public.produtos
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "produtos_insert_authenticated_tenant" on public.produtos;
create policy "produtos_insert_authenticated_tenant"
on public.produtos
for insert
to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "produtos_update_authenticated_tenant" on public.produtos;
create policy "produtos_update_authenticated_tenant"
on public.produtos
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "produtos_delete_authenticated_tenant" on public.produtos;
create policy "produtos_delete_authenticated_tenant"
on public.produtos
for delete
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "produtos_service_role_full_access" on public.produtos;
create policy "produtos_service_role_full_access"
on public.produtos
for all
to service_role
using (true)
with check (true);

grant all on table public.produtos to authenticated;
grant all on table public.produtos to service_role;
