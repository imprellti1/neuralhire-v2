create extension if not exists pgcrypto;

create table if not exists public.ai_director_tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  action_plan_id uuid not null references public.ai_director_action_plans(id) on delete cascade,
  manager_id text,
  manager_name text,
  category text not null default 'geral',
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'open',
  due_at timestamptz null,
  percentual_conclusao integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_director_tasks_status_check check (status in ('open', 'in_progress', 'done', 'blocked', 'cancelled')),
  constraint ai_director_tasks_percentual_check check (percentual_conclusao between 0 and 100)
);

alter table if exists public.ai_director_tasks
  add column if not exists manager_id text;

alter table if exists public.ai_director_tasks
  add column if not exists manager_name text;

alter table if exists public.ai_director_tasks
  add column if not exists category text;

alter table if exists public.ai_director_tasks
  add column if not exists title text;

alter table if exists public.ai_director_tasks
  add column if not exists description text;

alter table if exists public.ai_director_tasks
  add column if not exists priority text;

alter table if exists public.ai_director_tasks
  add column if not exists due_at timestamptz;

alter table if exists public.ai_director_tasks
  alter column category set default 'geral';

alter table if exists public.ai_director_tasks
  alter column priority set default 'medium';

alter table if exists public.ai_director_tasks
  alter column status set default 'open';

alter table if exists public.ai_director_tasks
  drop constraint if exists ai_director_tasks_status_check;

alter table if exists public.ai_director_tasks
  drop constraint if exists ai_director_tasks_percentual_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_director_tasks'
      and column_name = 'gerente'
  ) then
    execute 'alter table public.ai_director_tasks alter column gerente drop not null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_director_tasks'
      and column_name = 'titulo'
  ) then
    execute $$update public.ai_director_tasks
      set titulo = coalesce(titulo, title, 'Tarefa do Diretor IA')
      where titulo is null$$;
    execute 'alter table public.ai_director_tasks alter column titulo drop not null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_director_tasks'
      and column_name = 'descricao'
  ) then
    execute $$update public.ai_director_tasks
      set descricao = coalesce(descricao, description, '')
      where descricao is null$$;
    execute 'alter table public.ai_director_tasks alter column descricao drop not null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_director_tasks'
      and column_name = 'prioridade'
  ) then
    execute $$update public.ai_director_tasks
      set prioridade = coalesce(prioridade, priority, 'medium')
      where prioridade is null$$;
    execute 'alter table public.ai_director_tasks alter column prioridade drop not null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_director_tasks'
      and column_name = 'gerente'
  ) then
    execute $sql$
      update public.ai_director_tasks
      set gerente = coalesce(gerente, manager_name, manager_id, 'gerente_comercial')
      where gerente is null
    $sql$;
    execute 'alter table public.ai_director_tasks alter column gerente drop not null';
  end if;
end $$;

update public.ai_director_tasks
  set
    manager_id = coalesce(manager_id, gerente),
    manager_name = coalesce(manager_name, initcap(replace(coalesce(manager_id, gerente, ''), '_', ' '))),
    category = coalesce(category, 'geral'),
    title = coalesce(title, titulo, 'Tarefa do Diretor IA'),
    descricao = coalesce(descricao, description, ''),
    description = coalesce(description, descricao, ''),
    prioridade = coalesce(prioridade, priority, 'medium'),
    priority = coalesce(priority, prioridade, 'medium'),
    status = case
      when status in ('aberto', 'open') then 'open'
      when status in ('em_andamento', 'in_progress') then 'in_progress'
      when status in ('concluido', 'done') then 'done'
      when status in ('bloqueado', 'blocked') then 'blocked'
      when status in ('cancelado', 'cancelled') then 'cancelled'
      else coalesce(status, 'open')
    end,
    metadata = jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(metadata, '{}'::jsonb), '{normalized_dedupe_key}', to_jsonb(coalesce(metadata ->> 'normalized_dedupe_key', concat_ws('|', account_id::text, action_plan_id::text, coalesce(manager_id, gerente, ''), 'open'))), true),
        '{generated_by}', to_jsonb(coalesce(metadata ->> 'generated_by', 'diretor_delegacao')), true
      ),
      '{criteria_version}', to_jsonb(coalesce((metadata ->> 'criteria_version')::int, 2)), true
    ),
    updated_at = now();

update public.ai_director_tasks
  set title = coalesce(title, 'Plano de ação executivo')
where title is null;

update public.ai_director_tasks
  set titulo = coalesce(titulo, title, 'Tarefa do Diretor IA')
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ai_director_tasks'
    and column_name = 'titulo'
)
  and titulo is null;

update public.ai_director_tasks
  set category = coalesce(category, 'geral')
where category is null;

update public.ai_director_tasks
  set priority = coalesce(priority, 'medium')
where priority is null;

update public.ai_director_tasks
  set prioridade = coalesce(prioridade, priority, 'medium')
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ai_director_tasks'
    and column_name = 'prioridade'
)
  and prioridade is null;

update public.ai_director_tasks
  set descricao = coalesce(descricao, description, '')
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ai_director_tasks'
    and column_name = 'descricao'
)
  and descricao is null;

update public.ai_director_tasks
  set status = coalesce(status, 'open')
where status is null;

alter table if exists public.ai_director_tasks
  add constraint ai_director_tasks_status_check check (status in ('open', 'in_progress', 'done', 'blocked', 'cancelled'));

alter table if exists public.ai_director_tasks
  add constraint ai_director_tasks_percentual_check check (percentual_conclusao between 0 and 100);

with ranked_tasks as (
  select
    id,
    row_number() over (
      partition by account_id, action_plan_id, coalesce(manager_id, manager_name), status
      order by updated_at desc, criado_em desc, id desc
    ) as rn
  from public.ai_director_tasks
  where status in ('open', 'in_progress')
)
delete from public.ai_director_tasks t
using ranked_tasks r
where t.id = r.id
  and r.rn > 1;

create index if not exists ai_director_tasks_account_id_idx on public.ai_director_tasks (account_id);
create index if not exists ai_director_tasks_action_plan_id_idx on public.ai_director_tasks (action_plan_id);
create index if not exists ai_director_tasks_manager_id_idx on public.ai_director_tasks (manager_id);
create index if not exists ai_director_tasks_status_idx on public.ai_director_tasks (status);
create index if not exists ai_director_tasks_created_at_idx on public.ai_director_tasks (criado_em desc);
create index if not exists ai_director_tasks_due_at_idx on public.ai_director_tasks (due_at);

create unique index if not exists ai_director_tasks_delegacao_unique_idx
  on public.ai_director_tasks (
    account_id,
    action_plan_id,
    coalesce(manager_id, manager_name),
    status
  )
  where status in ('open', 'in_progress');
