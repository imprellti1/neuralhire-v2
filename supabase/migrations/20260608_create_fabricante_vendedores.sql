create extension if not exists pgcrypto;

create table if not exists public.fabricante_vendedores (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  fabricante_id uuid not null references public.fabricantes(id) on delete cascade,
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  status text not null default 'ativo',
  principal boolean not null default false,
  comissao_percentual numeric(5,2),
  pedido_minimo_valor numeric(14,2),
  valor_minimo_duplicata numeric(14,2),
  condicoes_pagamento jsonb not null default '[]'::jsonb,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fabricante_vendedores_status_check check (status in ('ativo', 'inativo')),
  constraint fabricante_vendedores_comissao_check check (comissao_percentual is null or (comissao_percentual >= 0 and comissao_percentual <= 100)),
  constraint fabricante_vendedores_pedido_minimo_check check (pedido_minimo_valor is null or pedido_minimo_valor >= 0),
  constraint fabricante_vendedores_duplicata_minima_check check (valor_minimo_duplicata is null or valor_minimo_duplicata >= 0),
  constraint fabricante_vendedores_condicoes_jsonb_check check (jsonb_typeof(condicoes_pagamento) = 'array'),
  constraint fabricante_vendedores_account_fabricante_vendedor_unique unique (account_id, fabricante_id, vendedor_id)
);

create unique index if not exists fabricante_vendedores_principal_unique_idx
  on public.fabricante_vendedores (account_id, fabricante_id)
  where principal = true;

create index if not exists idx_fabricante_vendedores_account_id on public.fabricante_vendedores (account_id);
create index if not exists idx_fabricante_vendedores_fabricante_id on public.fabricante_vendedores (fabricante_id);
create index if not exists idx_fabricante_vendedores_vendedor_id on public.fabricante_vendedores (vendedor_id);
create index if not exists idx_fabricante_vendedores_status on public.fabricante_vendedores (status);
create index if not exists idx_fabricante_vendedores_principal on public.fabricante_vendedores (principal);

drop trigger if exists trg_fabricante_vendedores_set_updated_at on public.fabricante_vendedores;
create trigger trg_fabricante_vendedores_set_updated_at
before update on public.fabricante_vendedores
for each row execute function public.set_updated_at();

grant all on table public.fabricante_vendedores to authenticated;
grant all on table public.fabricante_vendedores to service_role;

alter table public.fabricante_vendedores enable row level security;

drop policy if exists "fabricante_vendedores_select_authenticated_tenant" on public.fabricante_vendedores;
create policy "fabricante_vendedores_select_authenticated_tenant"
  on public.fabricante_vendedores
  for select
  to authenticated
  using (account_id = public.current_account_id());

drop policy if exists "fabricante_vendedores_insert_authenticated_tenant" on public.fabricante_vendedores;
create policy "fabricante_vendedores_insert_authenticated_tenant"
  on public.fabricante_vendedores
  for insert
  to authenticated
  with check (account_id = public.current_account_id());

drop policy if exists "fabricante_vendedores_update_authenticated_tenant" on public.fabricante_vendedores;
create policy "fabricante_vendedores_update_authenticated_tenant"
  on public.fabricante_vendedores
  for update
  to authenticated
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

drop policy if exists "fabricante_vendedores_delete_authenticated_tenant" on public.fabricante_vendedores;
create policy "fabricante_vendedores_delete_authenticated_tenant"
  on public.fabricante_vendedores
  for delete
  to authenticated
  using (account_id = public.current_account_id());

drop policy if exists "fabricante_vendedores_service_role_full_access" on public.fabricante_vendedores;
create policy "fabricante_vendedores_service_role_full_access"
  on public.fabricante_vendedores
  for all
  to service_role
  using (true)
  with check (true);
