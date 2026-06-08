create table if not exists public.system_audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid null,
  user_email text null,
  user_nome text null,
  modulo text not null,
  entidade text null,
  entidade_id text null,
  acao text not null,
  descricao text null,
  status text not null check (status in ('success', 'failed', 'partial')),
  sucesso boolean not null default true,
  request_id text null,
  ip text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  erro_codigo text null,
  erro_mensagem text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_audit_logs_account_id on public.system_audit_logs (account_id);
create index if not exists idx_system_audit_logs_user_id on public.system_audit_logs (user_id);
create index if not exists idx_system_audit_logs_modulo on public.system_audit_logs (modulo);
create index if not exists idx_system_audit_logs_entidade on public.system_audit_logs (entidade);
create index if not exists idx_system_audit_logs_entidade_id on public.system_audit_logs (entidade_id);
create index if not exists idx_system_audit_logs_acao on public.system_audit_logs (acao);
create index if not exists idx_system_audit_logs_status on public.system_audit_logs (status);
create index if not exists idx_system_audit_logs_created_at on public.system_audit_logs (created_at);
create index if not exists idx_system_audit_logs_request_id on public.system_audit_logs (request_id);

alter table public.system_audit_logs enable row level security;

create policy "system_audit_logs_account_isolation"
on public.system_audit_logs
for all
using (account_id = (auth.jwt() ->> 'account_id')::uuid)
with check (account_id = (auth.jwt() ->> 'account_id')::uuid);
