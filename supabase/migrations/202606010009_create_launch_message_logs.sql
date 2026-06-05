-- ETAPA 58B: launch_message_logs
create table if not exists public.launch_message_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  lead_id uuid not null,
  template_id uuid not null,
  channel text not null,
  status text not null,
  payload_preview text,
  created_at timestamptz not null default now()
);

create index if not exists idx_launch_message_logs_account_id on public.launch_message_logs(account_id);
create index if not exists idx_launch_message_logs_lead_id on public.launch_message_logs(lead_id);
create index if not exists idx_launch_message_logs_created_at on public.launch_message_logs(created_at);

alter table public.launch_message_logs enable row level security;

drop policy if exists launch_message_logs_authenticated on public.launch_message_logs;
create policy launch_message_logs_authenticated on public.launch_message_logs
for all to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists launch_message_logs_service_role on public.launch_message_logs;
create policy launch_message_logs_service_role on public.launch_message_logs
for all to service_role
using (true)
with check (true);

