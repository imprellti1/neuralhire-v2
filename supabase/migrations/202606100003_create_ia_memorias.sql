create table if not exists public.ia_memorias (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  tipo text not null,
  titulo text not null,
  conteudo text not null,
  tags text[] null,
  prioridade integer not null default 0,
  origem text null,
  modulo text null,
  status text not null default 'ativa',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ia_memorias_account_status_idx on public.ia_memorias (account_id, status, tipo, modulo);
create index if not exists ia_memorias_tags_gin_idx on public.ia_memorias using gin (tags);

