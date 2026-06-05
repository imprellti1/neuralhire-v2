create table if not exists public.vendedores (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid null,
  nome text not null,
  email text null,
  telefone text null,
  status text not null default 'ativo',
  observacoes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendedor_fabricantes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  fabricante_id uuid not null references public.fabricantes(id) on delete cascade,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, vendedor_id, fabricante_id)
);

alter table public.clientes add column if not exists vendedor_id uuid null references public.vendedores(id);

create index if not exists idx_vendedores_account_id on public.vendedores (account_id);
create index if not exists idx_vendedores_user_id on public.vendedores (user_id);
create index if not exists idx_vendedor_fabricantes_account_id on public.vendedor_fabricantes (account_id);
create index if not exists idx_vendedor_fabricantes_vendedor_id on public.vendedor_fabricantes (vendedor_id);
create index if not exists idx_vendedor_fabricantes_fabricante_id on public.vendedor_fabricantes (fabricante_id);
create index if not exists idx_clientes_vendedor_id on public.clientes (vendedor_id);

drop trigger if exists trg_vendedores_set_updated_at on public.vendedores;
create trigger trg_vendedores_set_updated_at
before update on public.vendedores
for each row execute function public.set_updated_at();

drop trigger if exists trg_vendedor_fabricantes_set_updated_at on public.vendedor_fabricantes;
create trigger trg_vendedor_fabricantes_set_updated_at
before update on public.vendedor_fabricantes
for each row execute function public.set_updated_at();

drop trigger if exists trg_clientes_set_updated_at on public.clientes;
create trigger trg_clientes_set_updated_at
before update on public.clientes
for each row execute function public.set_updated_at();

grant all on table public.vendedores to authenticated;
grant all on table public.vendedores to service_role;
grant all on table public.vendedor_fabricantes to authenticated;
grant all on table public.vendedor_fabricantes to service_role;
grant all on table public.clientes to authenticated;
grant all on table public.clientes to service_role;

alter table public.vendedores enable row level security;
alter table public.vendedor_fabricantes enable row level security;
alter table public.clientes enable row level security;

drop policy if exists "vendedores_service_role_all" on public.vendedores;
create policy "vendedores_service_role_all" on public.vendedores for all to service_role using (true) with check (true);
drop policy if exists "vendedor_fabricantes_service_role_all" on public.vendedor_fabricantes;
create policy "vendedor_fabricantes_service_role_all" on public.vendedor_fabricantes for all to service_role using (true) with check (true);
drop policy if exists "clientes_service_role_all" on public.clientes;
create policy "clientes_service_role_all" on public.clientes for all to service_role using (true) with check (true);
