create extension if not exists pgcrypto;

create table if not exists public.ai_director_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  status text not null default 'aberto',
  title text not null,
  description text not null,
  recurrence_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_director_events_status_check check (status in ('aberto', 'resolvido', 'reaberto')),
  constraint ai_director_events_recurrence_count_check check (recurrence_count >= 0)
);

create index if not exists ai_director_events_account_id_idx on public.ai_director_events (account_id);
create index if not exists ai_director_events_entity_type_idx on public.ai_director_events (entity_type);
create index if not exists ai_director_events_entity_id_idx on public.ai_director_events (entity_id);
create index if not exists ai_director_events_event_type_idx on public.ai_director_events (event_type);
create index if not exists ai_director_events_status_idx on public.ai_director_events (status);
create index if not exists ai_director_events_created_at_idx on public.ai_director_events (created_at desc);
create index if not exists ai_director_events_recurrence_count_idx on public.ai_director_events (recurrence_count desc, created_at desc);
