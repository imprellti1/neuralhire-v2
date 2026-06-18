create extension if not exists pgcrypto;

create table if not exists public.ai_director_tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  action_plan_id uuid not null references public.ai_director_action_plans(id) on delete cascade,
  gerente text not null,
  titulo text not null,
  descricao text,
  prioridade text not null,
  status text not null default 'aberto',
  percentual_conclusao integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_director_tasks_status_check check (status in ('aberto', 'em_andamento', 'concluido', 'bloqueado', 'cancelado')),
  constraint ai_director_tasks_percentual_check check (percentual_conclusao between 0 and 100)
);

create index if not exists ai_director_tasks_account_id_idx on public.ai_director_tasks (account_id);
create index if not exists ai_director_tasks_action_plan_id_idx on public.ai_director_tasks (action_plan_id);
create index if not exists ai_director_tasks_gerente_idx on public.ai_director_tasks (gerente);
create index if not exists ai_director_tasks_status_idx on public.ai_director_tasks (status);
create index if not exists ai_director_tasks_criado_em_idx on public.ai_director_tasks (criado_em desc);

create unique index if not exists ai_director_tasks_dedupe_idx
  on public.ai_director_tasks (account_id, action_plan_id, ((metadata ->> 'normalized_task_key')))
  where status <> 'cancelado';
