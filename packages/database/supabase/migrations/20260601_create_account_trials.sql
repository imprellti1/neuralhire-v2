create table if not exists public.account_trials (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  lead_id uuid not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists idx_account_trials_account_id on public.account_trials(account_id);
create index if not exists idx_account_trials_expires_at on public.account_trials(expires_at);
alter table public.account_trials enable row level security;
drop policy if exists account_trials_service_role on public.account_trials;
create policy account_trials_service_role on public.account_trials for all to service_role using (true) with check (true);
