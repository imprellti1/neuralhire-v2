create table if not exists public.customer_knowledge (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  customer_id uuid,
  phone text,
  remote_jid text,
  knowledge_key text not null,
  knowledge_value text,
  knowledge_type text not null default 'general',
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences integer not null default 1 check (occurrences >= 1),
  source_events jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_knowledge_account_scope_unique_idx
  on public.customer_knowledge (account_id, coalesce(phone, ''), coalesce(remote_jid, ''), knowledge_key);

create index if not exists idx_customer_knowledge_account_id on public.customer_knowledge (account_id);
create index if not exists idx_customer_knowledge_customer_id on public.customer_knowledge (customer_id);
create index if not exists idx_customer_knowledge_knowledge_key on public.customer_knowledge (knowledge_key);
create index if not exists idx_customer_knowledge_status on public.customer_knowledge (status);
create index if not exists idx_customer_knowledge_last_seen_at on public.customer_knowledge (last_seen_at);

create index if not exists idx_whatsapp_learning_knowledge_consolidation_status
  on public.whatsapp_learning_knowledge (account_id, status, created_at);

drop trigger if exists trg_customer_knowledge_set_updated_at on public.customer_knowledge;
create trigger trg_customer_knowledge_set_updated_at
before update on public.customer_knowledge
for each row
execute function public.set_updated_at();
