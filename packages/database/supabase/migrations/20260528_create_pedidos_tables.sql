-- ETAPA 14: tabelas de pedidos comerciais multi-tenant

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

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  cliente_id uuid not null references public.clientes(id),
  numero text null,
  status text not null default 'rascunho',
  origem text not null default 'manual',
  observacoes text null,
  subtotal numeric(12,2) not null default 0,
  desconto numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  produto_nome text not null,
  sku text null,
  quantidade numeric(12,3) not null default 1,
  preco_unitario numeric(12,2) not null default 0,
  desconto numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pedidos_account_id on public.pedidos (account_id);
create index if not exists idx_pedidos_cliente_id on public.pedidos (cliente_id);
create index if not exists idx_pedidos_status on public.pedidos (status);
create index if not exists idx_pedidos_created_at_desc on public.pedidos (created_at desc);

create index if not exists idx_pedido_itens_account_id on public.pedido_itens (account_id);
create index if not exists idx_pedido_itens_pedido_id on public.pedido_itens (pedido_id);
create index if not exists idx_pedido_itens_produto_id on public.pedido_itens (produto_id);

drop trigger if exists trg_pedidos_set_updated_at on public.pedidos;
create trigger trg_pedidos_set_updated_at
before update on public.pedidos
for each row
execute function public.set_updated_at();

drop trigger if exists trg_pedido_itens_set_updated_at on public.pedido_itens;
create trigger trg_pedido_itens_set_updated_at
before update on public.pedido_itens
for each row
execute function public.set_updated_at();

alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

drop policy if exists "pedidos_select_authenticated_tenant" on public.pedidos;
create policy "pedidos_select_authenticated_tenant" on public.pedidos for select to authenticated using (account_id = public.current_account_id());
drop policy if exists "pedidos_insert_authenticated_tenant" on public.pedidos;
create policy "pedidos_insert_authenticated_tenant" on public.pedidos for insert to authenticated with check (account_id = public.current_account_id());
drop policy if exists "pedidos_update_authenticated_tenant" on public.pedidos;
create policy "pedidos_update_authenticated_tenant" on public.pedidos for update to authenticated using (account_id = public.current_account_id()) with check (account_id = public.current_account_id());
drop policy if exists "pedidos_delete_authenticated_tenant" on public.pedidos;
create policy "pedidos_delete_authenticated_tenant" on public.pedidos for delete to authenticated using (account_id = public.current_account_id());
drop policy if exists "pedidos_service_role_full_access" on public.pedidos;
create policy "pedidos_service_role_full_access" on public.pedidos for all to service_role using (true) with check (true);

drop policy if exists "pedido_itens_select_authenticated_tenant" on public.pedido_itens;
create policy "pedido_itens_select_authenticated_tenant" on public.pedido_itens for select to authenticated using (account_id = public.current_account_id());
drop policy if exists "pedido_itens_insert_authenticated_tenant" on public.pedido_itens;
create policy "pedido_itens_insert_authenticated_tenant" on public.pedido_itens for insert to authenticated with check (account_id = public.current_account_id());
drop policy if exists "pedido_itens_update_authenticated_tenant" on public.pedido_itens;
create policy "pedido_itens_update_authenticated_tenant" on public.pedido_itens for update to authenticated using (account_id = public.current_account_id()) with check (account_id = public.current_account_id());
drop policy if exists "pedido_itens_delete_authenticated_tenant" on public.pedido_itens;
create policy "pedido_itens_delete_authenticated_tenant" on public.pedido_itens for delete to authenticated using (account_id = public.current_account_id());
drop policy if exists "pedido_itens_service_role_full_access" on public.pedido_itens;
create policy "pedido_itens_service_role_full_access" on public.pedido_itens for all to service_role using (true) with check (true);

grant all on table public.pedidos to authenticated;
grant all on table public.pedidos to service_role;
grant all on table public.pedido_itens to authenticated;
grant all on table public.pedido_itens to service_role;