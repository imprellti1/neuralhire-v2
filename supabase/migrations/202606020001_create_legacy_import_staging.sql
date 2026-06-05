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

create table if not exists public.legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  source text not null,
  status text not null,
  dry_run boolean not null default true,
  created_by text,
  summary jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legacy_import_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id) on delete cascade,
  account_id uuid not null,
  entity text not null,
  legacy_id text,
  natural_key text,
  status text not null,
  raw_payload jsonb not null,
  normalized_payload jsonb,
  issues_count integer not null default 0,
  target_entity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legacy_import_issues (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id) on delete cascade,
  record_id uuid references public.legacy_import_records(id) on delete cascade,
  account_id uuid not null,
  entity text not null,
  field text,
  code text,
  message text,
  severity text,
  created_at timestamptz not null default now()
);

create index if not exists idx_legacy_import_batches_account_id on public.legacy_import_batches (account_id);
create index if not exists idx_legacy_import_batches_status on public.legacy_import_batches (status);

create index if not exists idx_legacy_import_records_batch_id on public.legacy_import_records (batch_id);
create index if not exists idx_legacy_import_records_account_id on public.legacy_import_records (account_id);
create index if not exists idx_legacy_import_records_entity on public.legacy_import_records (entity);
create index if not exists idx_legacy_import_records_status on public.legacy_import_records (status);
create index if not exists idx_legacy_import_records_natural_key on public.legacy_import_records (natural_key);

create index if not exists idx_legacy_import_issues_batch_id on public.legacy_import_issues (batch_id);
create index if not exists idx_legacy_import_issues_record_id on public.legacy_import_issues (record_id);
create index if not exists idx_legacy_import_issues_account_id on public.legacy_import_issues (account_id);

drop trigger if exists trg_legacy_import_batches_set_updated_at on public.legacy_import_batches;
create trigger trg_legacy_import_batches_set_updated_at
before update on public.legacy_import_batches
for each row
execute function public.set_updated_at();

drop trigger if exists trg_legacy_import_records_set_updated_at on public.legacy_import_records;
create trigger trg_legacy_import_records_set_updated_at
before update on public.legacy_import_records
for each row
execute function public.set_updated_at();

alter table public.legacy_import_batches enable row level security;
alter table public.legacy_import_records enable row level security;
alter table public.legacy_import_issues enable row level security;

drop policy if exists "legacy_import_batches_select_authenticated_tenant" on public.legacy_import_batches;
create policy "legacy_import_batches_select_authenticated_tenant"
on public.legacy_import_batches
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "legacy_import_batches_insert_authenticated_tenant" on public.legacy_import_batches;
create policy "legacy_import_batches_insert_authenticated_tenant"
on public.legacy_import_batches
for insert
to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "legacy_import_batches_update_authenticated_tenant" on public.legacy_import_batches;
create policy "legacy_import_batches_update_authenticated_tenant"
on public.legacy_import_batches
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "legacy_import_batches_delete_authenticated_tenant" on public.legacy_import_batches;
create policy "legacy_import_batches_delete_authenticated_tenant"
on public.legacy_import_batches
for delete
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "legacy_import_batches_service_role_full_access" on public.legacy_import_batches;
create policy "legacy_import_batches_service_role_full_access"
on public.legacy_import_batches
for all
to service_role
using (true)
with check (true);

drop policy if exists "legacy_import_records_select_authenticated_tenant" on public.legacy_import_records;
create policy "legacy_import_records_select_authenticated_tenant"
on public.legacy_import_records
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "legacy_import_records_insert_authenticated_tenant" on public.legacy_import_records;
create policy "legacy_import_records_insert_authenticated_tenant"
on public.legacy_import_records
for insert
to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "legacy_import_records_update_authenticated_tenant" on public.legacy_import_records;
create policy "legacy_import_records_update_authenticated_tenant"
on public.legacy_import_records
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "legacy_import_records_delete_authenticated_tenant" on public.legacy_import_records;
create policy "legacy_import_records_delete_authenticated_tenant"
on public.legacy_import_records
for delete
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "legacy_import_records_service_role_full_access" on public.legacy_import_records;
create policy "legacy_import_records_service_role_full_access"
on public.legacy_import_records
for all
to service_role
using (true)
with check (true);

drop policy if exists "legacy_import_issues_select_authenticated_tenant" on public.legacy_import_issues;
create policy "legacy_import_issues_select_authenticated_tenant"
on public.legacy_import_issues
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "legacy_import_issues_insert_authenticated_tenant" on public.legacy_import_issues;
create policy "legacy_import_issues_insert_authenticated_tenant"
on public.legacy_import_issues
for insert
to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "legacy_import_issues_update_authenticated_tenant" on public.legacy_import_issues;
create policy "legacy_import_issues_update_authenticated_tenant"
on public.legacy_import_issues
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "legacy_import_issues_delete_authenticated_tenant" on public.legacy_import_issues;
create policy "legacy_import_issues_delete_authenticated_tenant"
on public.legacy_import_issues
for delete
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "legacy_import_issues_service_role_full_access" on public.legacy_import_issues;
create policy "legacy_import_issues_service_role_full_access"
on public.legacy_import_issues
for all
to service_role
using (true)
with check (true);

grant all on table public.legacy_import_batches to authenticated;
grant all on table public.legacy_import_batches to service_role;
grant all on table public.legacy_import_records to authenticated;
grant all on table public.legacy_import_records to service_role;
grant all on table public.legacy_import_issues to authenticated;
grant all on table public.legacy_import_issues to service_role;
