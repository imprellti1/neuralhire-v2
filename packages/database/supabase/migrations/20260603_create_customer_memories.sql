create table if not exists customer_memories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  cliente_id uuid not null,
  memory jsonb not null default '{}'::jsonb,
  risk_score integer not null default 0,
  potential_score integer not null default 0,
  last_rebuilt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_memories_account_cliente_idx
  on customer_memories (account_id, cliente_id);
