create table if not exists public.ai_director_memories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  tipo text not null,
  titulo text not null,
  conteudo text not null,
  prioridade text not null default 'media',
  origem text not null default 'diretor_ia',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_director_memories_tipo_check check (tipo in ('observacao', 'alerta', 'oportunidade', 'diagnostico', 'decisao', 'plano_acao')),
  constraint ai_director_memories_prioridade_check check (prioridade in ('baixa', 'media', 'alta', 'critica'))
);

create index if not exists ai_director_memories_account_created_idx on public.ai_director_memories (account_id, created_at desc);
