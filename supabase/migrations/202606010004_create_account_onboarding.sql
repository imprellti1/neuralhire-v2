create table if not exists public.account_onboarding (
  id uuid primary key,
  account_id uuid not null,
  status text not null default 'not_started',
  current_step text,
  completed_steps jsonb not null default '[]'::jsonb,
  company_profile jsonb not null default '{}'::jsonb,
  team_profile jsonb not null default '{}'::jsonb,
  commercial_profile jsonb not null default '{}'::jsonb,
  import_profile jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_account_onboarding_account_id on public.account_onboarding(account_id);
create index if not exists idx_account_onboarding_status on public.account_onboarding(status);
create index if not exists idx_account_onboarding_current_step on public.account_onboarding(current_step);
