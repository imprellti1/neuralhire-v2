alter table public.interest_leads
  add column if not exists invite_status text not null default 'nao_convidado',
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_opened_at timestamptz,
  add column if not exists invite_response_at timestamptz,
  add column if not exists launch_batch text;

create index if not exists idx_interest_leads_invite_status on public.interest_leads (invite_status);
create index if not exists idx_interest_leads_launch_batch on public.interest_leads (launch_batch);
