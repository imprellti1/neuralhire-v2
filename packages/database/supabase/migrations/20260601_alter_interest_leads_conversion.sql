alter table public.interest_leads add column if not exists converted_account_id uuid;
alter table public.interest_leads add column if not exists converted_at timestamptz;
create index if not exists idx_interest_leads_converted_account_id on public.interest_leads(converted_account_id);
create index if not exists idx_interest_leads_converted_at on public.interest_leads(converted_at);
