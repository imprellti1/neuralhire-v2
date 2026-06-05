create table if not exists commercial_agent_actions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  conversation_id text,
  cliente_id text,
  action_type text,
  confidence_score integer,
  reason text,
  context jsonb,
  recommendation jsonb,
  created_at timestamptz default now()
);

create index if not exists commercial_agent_actions_account_conversation_idx
  on commercial_agent_actions (account_id, conversation_id, created_at desc);
