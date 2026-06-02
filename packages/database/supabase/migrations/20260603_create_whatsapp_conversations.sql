create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  cliente_id text,
  vendedor_id text,
  phone text not null,
  contact_name text,
  status text not null default 'open',
  origin text not null default 'manual',
  channel text not null default 'whatsapp',
  last_message_at timestamptz,
  assigned_to text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  cliente_id text,
  direction text not null,
  sender_type text not null,
  sender_id text,
  phone text not null,
  body text not null,
  message_type text not null default 'text',
  external_message_id text,
  status text not null default 'received',
  metadata jsonb default '{}'::jsonb,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.whatsapp_conversation_events (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  type text not null,
  payload jsonb default '{}'::jsonb,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists idx_whatsapp_conversations_account_id on public.whatsapp_conversations(account_id);
create index if not exists idx_whatsapp_conversations_cliente_id on public.whatsapp_conversations(cliente_id);
create index if not exists idx_whatsapp_conversations_vendedor_id on public.whatsapp_conversations(vendedor_id);
create index if not exists idx_whatsapp_conversations_phone on public.whatsapp_conversations(phone);
create index if not exists idx_whatsapp_conversations_status on public.whatsapp_conversations(status);
create index if not exists idx_whatsapp_conversations_last_message_at on public.whatsapp_conversations(last_message_at);

create index if not exists idx_whatsapp_messages_account_id on public.whatsapp_messages(account_id);
create index if not exists idx_whatsapp_messages_conversation_id on public.whatsapp_messages(conversation_id);
create index if not exists idx_whatsapp_messages_cliente_id on public.whatsapp_messages(cliente_id);
create index if not exists idx_whatsapp_messages_phone on public.whatsapp_messages(phone);
create index if not exists idx_whatsapp_messages_direction on public.whatsapp_messages(direction);
create index if not exists idx_whatsapp_messages_status on public.whatsapp_messages(status);
create index if not exists idx_whatsapp_messages_created_at on public.whatsapp_messages(created_at);

create index if not exists idx_whatsapp_events_account_id on public.whatsapp_conversation_events(account_id);
create index if not exists idx_whatsapp_events_conversation_id on public.whatsapp_conversation_events(conversation_id);
create index if not exists idx_whatsapp_events_type on public.whatsapp_conversation_events(type);
create index if not exists idx_whatsapp_events_created_at on public.whatsapp_conversation_events(created_at);
