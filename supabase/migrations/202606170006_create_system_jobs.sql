create extension if not exists pgcrypto;

create table if not exists public.system_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid null,
  nome text not null,
  status text not null default 'idle',
  lock_key text unique,
  locked_at timestamptz null,
  locked_by text null,
  last_run_at timestamptz null,
  next_run_at timestamptz null,
  last_success_at timestamptz null,
  last_error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_jobs_account_id_idx on public.system_jobs (account_id);
create index if not exists system_jobs_status_idx on public.system_jobs (status);
create index if not exists system_jobs_next_run_at_idx on public.system_jobs (next_run_at);

create table if not exists public.system_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.system_jobs(id) on delete cascade,
  account_id uuid null,
  nome text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  duration_ms integer null,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error text null
);

create index if not exists system_job_runs_job_id_idx on public.system_job_runs (job_id);
create index if not exists system_job_runs_account_id_idx on public.system_job_runs (account_id);
create index if not exists system_job_runs_started_at_idx on public.system_job_runs (started_at desc);

create table if not exists public.cliente_automacao_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  cliente_id uuid not null,
  tipo text not null,
  status text not null,
  detalhe text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cliente_automacao_logs_account_id_idx on public.cliente_automacao_logs (account_id);
create index if not exists cliente_automacao_logs_cliente_id_idx on public.cliente_automacao_logs (cliente_id);
create index if not exists cliente_automacao_logs_tipo_created_at_idx on public.cliente_automacao_logs (tipo, created_at desc);
