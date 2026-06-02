-- ETAPA 58B: launch_message_templates
create table if not exists public.launch_message_templates (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  channel text not null,
  name text not null,
  subject text,
  body text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_launch_message_templates_account_id on public.launch_message_templates(account_id);
create index if not exists idx_launch_message_templates_status on public.launch_message_templates(status);

alter table public.launch_message_templates enable row level security;

drop policy if exists launch_message_templates_authenticated on public.launch_message_templates;
create policy launch_message_templates_authenticated on public.launch_message_templates
for all to authenticated
using (account_id = 'pre-lancamento')
with check (account_id = 'pre-lancamento');

drop policy if exists launch_message_templates_service_role on public.launch_message_templates;
create policy launch_message_templates_service_role on public.launch_message_templates
for all to service_role
using (true)
with check (true);
