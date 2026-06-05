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

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid null,
  nome text not null,
  documento text null,
  email text null,
  telefone text null,
  cidade text null,
  estado text null,
  tags text[] not null default '{}',
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clientes_account_id on public.clientes (account_id);
create index if not exists idx_clientes_documento on public.clientes (documento);
create index if not exists idx_clientes_email on public.clientes (email);
create index if not exists idx_clientes_created_at_desc on public.clientes (created_at desc);

drop trigger if exists trg_clientes_set_updated_at on public.clientes;
create trigger trg_clientes_set_updated_at
before update on public.clientes
for each row
execute function public.set_updated_at();

grant all on table public.clientes to authenticated;
grant all on table public.clientes to service_role;

grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to service_role;

alter table public.clientes enable row level security;

drop policy if exists "clientes_authenticated_all" on public.clientes;
create policy "clientes_authenticated_all"
on public.clientes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "clientes_service_role_all" on public.clientes;
create policy "clientes_service_role_all"
on public.clientes
for all
to service_role
using (true)
with check (true);
