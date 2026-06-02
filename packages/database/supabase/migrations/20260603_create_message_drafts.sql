create table if not exists public.message_drafts (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  conversation_id text,
  cliente_id text,
  customer_memory_id text,
  draft_type text,
  status text,
  confidence_score integer,
  reason text,
  context jsonb default '{}'::jsonb,
  draft_text text,
  approved_by text,
  approved_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_message_drafts_account_id on public.message_drafts(account_id);
create index if not exists idx_message_drafts_conversation_id on public.message_drafts(conversation_id);
create index if not exists idx_message_drafts_cliente_id on public.message_drafts(cliente_id);
create index if not exists idx_message_drafts_status on public.message_drafts(status);
create index if not exists idx_message_drafts_created_at on public.message_drafts(created_at);
