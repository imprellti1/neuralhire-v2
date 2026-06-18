create table if not exists public.ai_director_executive_memories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  tipo text not null,
  categoria text not null default 'geral',
  titulo text not null,
  descricao text not null,
  severidade text not null default 'media',
  origem text not null default 'diretor_ia',
  metadata jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_director_executive_memories
  add column if not exists categoria text not null default 'geral';

alter table public.ai_director_executive_memories
  add column if not exists descricao text not null default '';

alter table public.ai_director_executive_memories
  add column if not exists severidade text not null default 'media';

alter table public.ai_director_executive_memories
  add column if not exists origem text not null default 'diretor_ia';

alter table public.ai_director_executive_memories
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.ai_director_executive_memories
  add column if not exists criado_em timestamptz not null default now();

alter table public.ai_director_executive_memories
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ai_director_executive_memories_logical_dedupe_idx
  on public.ai_director_executive_memories (
    account_id,
    tipo,
    categoria,
    lower(titulo),
    origem
  );
