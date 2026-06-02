create table if not exists public.whatsapp_delivery_logs (
  id uuid primary key,
  account_id text not null,
  conversation_id text,
  draft_id text,
  message_id text,
  external_message_id text,
  phone text,
  status text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_by text,
  created_at timestamptz default now()
);
