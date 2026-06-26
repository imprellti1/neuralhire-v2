create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  name text,
  provider text not null default 'evolution',
  instance_name text not null,
  phone_number text,
  status text not null default 'unknown',
  webhook_secret text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  instance_id uuid references public.whatsapp_instances(id) on delete set null,
  cliente_id uuid,
  lead_id uuid,
  remote_jid text not null,
  phone_normalized text,
  contact_name text,
  status text not null default 'open',
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  instance_id uuid references public.whatsapp_instances(id) on delete set null,
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  cliente_id uuid,
  lead_id uuid,
  provider text not null default 'evolution',
  event_type text,
  message_id text not null,
  remote_jid text not null,
  phone_normalized text,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('cliente', 'vendedor', 'agente', 'sistema', 'unknown')),
  message_type text,
  body text,
  raw_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  instance_id uuid references public.whatsapp_instances(id) on delete set null,
  remote_jid text not null,
  phone_normalized text,
  name text,
  status text not null default 'pending',
  cliente_id uuid,
  first_message_at timestamptz,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_customer_memories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  cliente_id uuid,
  lead_id uuid,
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  source_message_ids uuid[] not null default '{}'::uuid[],
  memory_type text,
  title text not null,
  description text,
  intent text,
  sentiment text,
  commercial_signal text,
  confidence numeric not null default 0,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_conversations
  add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete set null,
  add column if not exists lead_id uuid,
  add column if not exists remote_jid text,
  add column if not exists phone_normalized text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.whatsapp_conversations
set remote_jid = coalesce(remote_jid, phone, ''),
    phone_normalized = coalesce(phone_normalized, phone),
    metadata = coalesce(metadata, '{}'::jsonb)
where remote_jid is null
   or phone_normalized is null
   or metadata is null;

alter table public.whatsapp_conversations
  alter column remote_jid set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table public.whatsapp_conversations
  alter column instance_id drop not null;

alter table public.whatsapp_messages
  add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete set null,
  add column if not exists lead_id uuid,
  add column if not exists provider text not null default 'evolution',
  add column if not exists event_type text,
  add column if not exists message_id text,
  add column if not exists remote_jid text,
  add column if not exists phone_normalized text,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.whatsapp_messages
set message_id = coalesce(message_id, external_message_id, id::text),
    remote_jid = coalesce(remote_jid, phone, ''),
    phone_normalized = coalesce(phone_normalized, phone),
    raw_payload = coalesce(raw_payload, '{}'::jsonb)
where message_id is null
   or remote_jid is null
   or phone_normalized is null
   or raw_payload is null;

alter table public.whatsapp_messages
  alter column message_id set not null,
  alter column remote_jid set not null,
  alter column raw_payload set default '{}'::jsonb,
  alter column raw_payload set not null;

alter table public.whatsapp_messages
  alter column conversation_id drop not null,
  alter column instance_id drop not null;

alter table public.whatsapp_leads
  add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete set null,
  add column if not exists remote_jid text,
  add column if not exists phone_normalized text,
  add column if not exists status text not null default 'pending',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.whatsapp_leads
set remote_jid = coalesce(remote_jid, ''),
    metadata = coalesce(metadata, '{}'::jsonb)
where remote_jid is null
   or metadata is null;

alter table public.whatsapp_leads
  alter column remote_jid set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table public.whatsapp_customer_memories
  add column if not exists lead_id uuid,
  add column if not exists source_message_ids uuid[] not null default '{}'::uuid[],
  add column if not exists memory_type text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists intent text,
  add column if not exists sentiment text,
  add column if not exists commercial_signal text,
  add column if not exists confidence numeric not null default 0,
  add column if not exists status text not null default 'active',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.whatsapp_customer_memories
set title = coalesce(title, 'Memoria conversacional'),
    metadata = coalesce(metadata, '{}'::jsonb)
where title is null
   or metadata is null;

alter table public.whatsapp_customer_memories
  alter column title set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table public.whatsapp_customer_memories
  alter column cliente_id drop not null,
  alter column lead_id drop not null,
  alter column conversation_id drop not null;

create index if not exists idx_whatsapp_instances_account_id on public.whatsapp_instances (account_id);
create index if not exists idx_whatsapp_instances_instance_name on public.whatsapp_instances (instance_name);
create index if not exists idx_whatsapp_instances_phone_number on public.whatsapp_instances (phone_number);

create index if not exists idx_whatsapp_conversations_account_id on public.whatsapp_conversations (account_id);
create index if not exists idx_whatsapp_conversations_instance_id on public.whatsapp_conversations (instance_id);
create index if not exists idx_whatsapp_conversations_cliente_id on public.whatsapp_conversations (cliente_id);
create index if not exists idx_whatsapp_conversations_lead_id on public.whatsapp_conversations (lead_id);
create index if not exists idx_whatsapp_conversations_remote_jid on public.whatsapp_conversations (remote_jid);
create index if not exists idx_whatsapp_conversations_phone_normalized on public.whatsapp_conversations (phone_normalized);
create index if not exists idx_whatsapp_conversations_status on public.whatsapp_conversations (status);
create index if not exists idx_whatsapp_conversations_last_message_at on public.whatsapp_conversations (last_message_at);

create index if not exists idx_whatsapp_messages_account_id on public.whatsapp_messages (account_id);
create index if not exists idx_whatsapp_messages_instance_id on public.whatsapp_messages (instance_id);
create index if not exists idx_whatsapp_messages_conversation_id on public.whatsapp_messages (conversation_id);
create index if not exists idx_whatsapp_messages_cliente_id on public.whatsapp_messages (cliente_id);
create index if not exists idx_whatsapp_messages_lead_id on public.whatsapp_messages (lead_id);
create index if not exists idx_whatsapp_messages_remote_jid on public.whatsapp_messages (remote_jid);
create index if not exists idx_whatsapp_messages_phone_normalized on public.whatsapp_messages (phone_normalized);
create index if not exists idx_whatsapp_messages_message_id on public.whatsapp_messages (message_id);
create index if not exists idx_whatsapp_messages_created_at on public.whatsapp_messages (created_at);

create unique index if not exists whatsapp_messages_account_provider_message_id_idx
  on public.whatsapp_messages (account_id, provider, message_id);

create index if not exists idx_whatsapp_leads_account_id on public.whatsapp_leads (account_id);
create index if not exists idx_whatsapp_leads_instance_id on public.whatsapp_leads (instance_id);
create index if not exists idx_whatsapp_leads_remote_jid on public.whatsapp_leads (remote_jid);
create index if not exists idx_whatsapp_leads_phone_normalized on public.whatsapp_leads (phone_normalized);
create index if not exists idx_whatsapp_leads_cliente_id on public.whatsapp_leads (cliente_id);
create index if not exists idx_whatsapp_leads_status on public.whatsapp_leads (status);
create index if not exists idx_whatsapp_leads_last_message_at on public.whatsapp_leads (last_message_at);

create index if not exists idx_whatsapp_customer_memories_account_id on public.whatsapp_customer_memories (account_id);
create index if not exists idx_whatsapp_customer_memories_cliente_id on public.whatsapp_customer_memories (cliente_id);
create index if not exists idx_whatsapp_customer_memories_lead_id on public.whatsapp_customer_memories (lead_id);
create index if not exists idx_whatsapp_customer_memories_conversation_id on public.whatsapp_customer_memories (conversation_id);

drop trigger if exists trg_whatsapp_instances_set_updated_at on public.whatsapp_instances;
create trigger trg_whatsapp_instances_set_updated_at
before update on public.whatsapp_instances
for each row
execute function public.set_updated_at();

drop trigger if exists trg_whatsapp_conversations_set_updated_at on public.whatsapp_conversations;
create trigger trg_whatsapp_conversations_set_updated_at
before update on public.whatsapp_conversations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_whatsapp_messages_set_updated_at on public.whatsapp_messages;
create trigger trg_whatsapp_messages_set_updated_at
before update on public.whatsapp_messages
for each row
execute function public.set_updated_at();

drop trigger if exists trg_whatsapp_leads_set_updated_at on public.whatsapp_leads;
create trigger trg_whatsapp_leads_set_updated_at
before update on public.whatsapp_leads
for each row
execute function public.set_updated_at();

drop trigger if exists trg_whatsapp_customer_memories_set_updated_at on public.whatsapp_customer_memories;
create trigger trg_whatsapp_customer_memories_set_updated_at
before update on public.whatsapp_customer_memories
for each row
execute function public.set_updated_at();
