create table if not exists public.ai_director_observations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,

  manager_id text not null,
  manager_name text not null,

  category text not null,

  title text not null,
  description text not null,

  severity text not null default 'medium',
  impact_score integer not null default 0,
  urgency_score integer not null default 0,

  status text not null default 'open',

  source_type text,
  source_id text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_director_observations_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint ai_director_observations_status_check check (status in ('open', 'acknowledged', 'resolved')),
  constraint ai_director_observations_impact_score_check check (impact_score between 0 and 100),
  constraint ai_director_observations_urgency_score_check check (urgency_score between 0 and 100)
);

create index if not exists idx_ai_director_observations_account_id on public.ai_director_observations(account_id);
create index if not exists idx_ai_director_observations_manager_id on public.ai_director_observations(manager_id);
create index if not exists idx_ai_director_observations_category on public.ai_director_observations(category);
create index if not exists idx_ai_director_observations_severity on public.ai_director_observations(severity);
create index if not exists idx_ai_director_observations_status on public.ai_director_observations(status);
create index if not exists idx_ai_director_observations_created_at on public.ai_director_observations(created_at desc);

drop trigger if exists update_ai_director_observations_updated_at on public.ai_director_observations;
create trigger update_ai_director_observations_updated_at
before update on public.ai_director_observations
for each row
execute function public.set_updated_at();
