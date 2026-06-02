alter table if exists public.message_drafts
  add column if not exists action_id text,
  add column if not exists action_type text,
  add column if not exists action_confidence integer,
  add column if not exists action_reason text;

create index if not exists idx_message_drafts_action_type on public.message_drafts(action_type);
