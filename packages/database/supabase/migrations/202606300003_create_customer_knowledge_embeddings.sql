create table if not exists public.customer_knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  customer_knowledge_id uuid not null references public.customer_knowledge(id) on delete cascade,
  embedding_provider text not null default 'disabled',
  embedding_model text,
  embedding_dimensions integer not null default 0 check (embedding_dimensions >= 0),
  embedding_status text not null default 'pending',
  embedding_version integer not null default 1 check (embedding_version >= 1),
  embedding_hash text not null,
  embedding_metadata jsonb not null default '{}'::jsonb,
  last_attempt_at timestamptz,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_knowledge_embeddings_account_customer_unique_idx
  on public.customer_knowledge_embeddings (account_id, customer_knowledge_id);

create index if not exists idx_customer_knowledge_embeddings_account_id on public.customer_knowledge_embeddings (account_id);
create index if not exists idx_customer_knowledge_embeddings_customer_knowledge_id on public.customer_knowledge_embeddings (customer_knowledge_id);
create index if not exists idx_customer_knowledge_embeddings_status on public.customer_knowledge_embeddings (embedding_status);

drop trigger if exists trg_customer_knowledge_embeddings_set_updated_at on public.customer_knowledge_embeddings;
create trigger trg_customer_knowledge_embeddings_set_updated_at
before update on public.customer_knowledge_embeddings
for each row
execute function public.set_updated_at();
