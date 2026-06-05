create extension if not exists pgcrypto;

create table if not exists public.interest_lead_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  lead_id uuid not null references public.interest_leads(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_interest_lead_events_account_id on public.interest_lead_events (account_id);
create index if not exists idx_interest_lead_events_lead_id on public.interest_lead_events (lead_id);
create index if not exists idx_interest_lead_events_created_at on public.interest_lead_events (created_at desc);

alter table public.interest_lead_events enable row level security;

drop policy if exists "interest_lead_events_select_authenticated_tenant" on public.interest_lead_events;
create policy "interest_lead_events_select_authenticated_tenant"
on public.interest_lead_events
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "interest_lead_events_insert_authenticated_tenant" on public.interest_lead_events;
create policy "interest_lead_events_insert_authenticated_tenant"
on public.interest_lead_events
for insert
to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "interest_lead_events_update_authenticated_tenant" on public.interest_lead_events;
create policy "interest_lead_events_update_authenticated_tenant"
on public.interest_lead_events
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "interest_lead_events_delete_authenticated_tenant" on public.interest_lead_events;
create policy "interest_lead_events_delete_authenticated_tenant"
on public.interest_lead_events
for delete
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "interest_lead_events_service_role_full_access" on public.interest_lead_events;
create policy "interest_lead_events_service_role_full_access"
on public.interest_lead_events
for all
to service_role
using (true)
with check (true);

grant all on table public.interest_lead_events to authenticated;
grant all on table public.interest_lead_events to service_role;
