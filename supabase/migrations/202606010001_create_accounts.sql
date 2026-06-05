create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'trial',
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_accounts_status on public.accounts(status);
alter table public.accounts enable row level security;
drop policy if exists accounts_service_role on public.accounts;
create policy accounts_service_role on public.accounts for all to service_role using (true) with check (true);
