create table if not exists public.whatsapp_learning_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  whatsapp_message_id text not null,
  message_id uuid,
  conversation_id uuid,
  lead_id uuid,
  source text not null default 'whatsapp',
  content_type text not null default 'text',
  body text,
  intent text not null default 'unknown',
  sentiment text not null default 'neutral',
  importance integer not null default 1 check (importance >= 1 and importance <= 10),
  summary text,
  needs_followup boolean not null default false,
  next_action text,
  entities jsonb not null default '{}'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  normalized_text text,
  normalized_payload jsonb,
  normalized_at timestamptz,
  processing_error text,
  status text not null default 'pending',
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_learning_events_account_message_unique_idx
  on public.whatsapp_learning_events (account_id, whatsapp_message_id);

create index if not exists idx_whatsapp_learning_events_account_id on public.whatsapp_learning_events (account_id);
create index if not exists idx_whatsapp_learning_events_status on public.whatsapp_learning_events (status);
create index if not exists idx_whatsapp_learning_events_created_at on public.whatsapp_learning_events (created_at);

drop trigger if exists trg_whatsapp_learning_events_set_updated_at on public.whatsapp_learning_events;
create trigger trg_whatsapp_learning_events_set_updated_at
before update on public.whatsapp_learning_events
for each row
execute function public.set_updated_at();
