create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.interest_leads (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  nome text not null,
  empresa text,
  email text,
  whatsapp text,
  cidade text,
  uf text,
  origem text,
  status text not null default 'novo',
  observacoes text,
  responsavel text,
  ultimo_contato_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interest_leads_account_id on public.interest_leads (account_id);
create index if not exists idx_interest_leads_status on public.interest_leads (status);
create index if not exists idx_interest_leads_email on public.interest_leads (email);
create index if not exists idx_interest_leads_created_at on public.interest_leads (created_at desc);

drop trigger if exists trg_interest_leads_set_updated_at on public.interest_leads;
create trigger trg_interest_leads_set_updated_at
before update on public.interest_leads
for each row
execute function public.set_updated_at();

alter table public.interest_leads enable row level security;

drop policy if exists "interest_leads_select_authenticated_tenant" on public.interest_leads;
create policy "interest_leads_select_authenticated_tenant"
on public.interest_leads
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "interest_leads_insert_authenticated_tenant" on public.interest_leads;
create policy "interest_leads_insert_authenticated_tenant"
on public.interest_leads
for insert
to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "interest_leads_update_authenticated_tenant" on public.interest_leads;
create policy "interest_leads_update_authenticated_tenant"
on public.interest_leads
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "interest_leads_delete_authenticated_tenant" on public.interest_leads;
create policy "interest_leads_delete_authenticated_tenant"
on public.interest_leads
for delete
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "interest_leads_service_role_full_access" on public.interest_leads;
create policy "interest_leads_service_role_full_access"
on public.interest_leads
for all
to service_role
using (true)
with check (true);

grant all on table public.interest_leads to authenticated;
grant all on table public.interest_leads to service_role;
