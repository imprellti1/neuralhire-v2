create table if not exists public.ai_director_action_plans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  executive_memory_id uuid not null references public.ai_director_executive_memories(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  gerente_responsavel text not null,
  impacto text not null,
  esforco text not null,
  prioridade_score integer not null default 0,
  prazo_dias integer null,
  status text not null default 'aberto',
  metadata jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_director_action_plans_account_id_idx on public.ai_director_action_plans (account_id);
create index if not exists ai_director_action_plans_executive_memory_id_idx on public.ai_director_action_plans (executive_memory_id);
create index if not exists ai_director_action_plans_status_idx on public.ai_director_action_plans (status);
create index if not exists ai_director_action_plans_gerente_responsavel_idx on public.ai_director_action_plans (gerente_responsavel);
create index if not exists ai_director_action_plans_criado_em_desc_idx on public.ai_director_action_plans (criado_em desc);

create unique index if not exists ai_director_action_plans_open_unique_idx
  on public.ai_director_action_plans (account_id, executive_memory_id)
  where status = 'aberto';
