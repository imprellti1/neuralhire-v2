create table if not exists public.message_draft_approvals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  draft_id text not null,
  conversation_id text,
  cliente_id text,
  status text not null,
  reviewer_id text,
  reviewer_name text,
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_message_draft_approvals_account_id on public.message_draft_approvals(account_id);
create index if not exists idx_message_draft_approvals_draft_id on public.message_draft_approvals(draft_id);
create index if not exists idx_message_draft_approvals_conversation_id on public.message_draft_approvals(conversation_id);
create index if not exists idx_message_draft_approvals_status on public.message_draft_approvals(status);
create index if not exists idx_message_draft_approvals_created_at on public.message_draft_approvals(created_at);
