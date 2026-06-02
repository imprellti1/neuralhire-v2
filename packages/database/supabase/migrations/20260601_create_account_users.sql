create table if not exists public.account_users (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  email text not null,
  nome text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_account_users_account_id on public.account_users(account_id);
alter table public.account_users enable row level security;
drop policy if exists account_users_service_role on public.account_users;
create policy account_users_service_role on public.account_users for all to service_role using (true) with check (true);
