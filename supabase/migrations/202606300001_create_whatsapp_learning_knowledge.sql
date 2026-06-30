create table if not exists public.whatsapp_learning_knowledge (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  source_event_id uuid not null,
  source_provider text,
  source_instance text,
  source_instance_type text,
  direction text,
  phone text,
  remote_jid text,
  normalized_text text,
  knowledge_type text not null default 'general',
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  intent text not null default 'unknown',
  sentiment text not null default 'neutral',
  entities jsonb not null default '{}'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  summary text,
  raw_cognitive_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'learned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_learning_knowledge_account_source_event_unique_idx
  on public.whatsapp_learning_knowledge (account_id, source_event_id);

create index if not exists idx_whatsapp_learning_knowledge_account_id on public.whatsapp_learning_knowledge (account_id);
create index if not exists idx_whatsapp_learning_knowledge_status on public.whatsapp_learning_knowledge (status);
create index if not exists idx_whatsapp_learning_knowledge_created_at on public.whatsapp_learning_knowledge (created_at);

drop trigger if exists trg_whatsapp_learning_knowledge_set_updated_at on public.whatsapp_learning_knowledge;
create trigger trg_whatsapp_learning_knowledge_set_updated_at
before update on public.whatsapp_learning_knowledge
for each row
execute function public.set_updated_at();
