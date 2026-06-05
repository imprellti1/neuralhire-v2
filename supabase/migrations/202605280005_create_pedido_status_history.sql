-- ETAPA 15: trilha de status e auditoria comercial para pedidos multi-tenant.
-- Esta tabela guarda historico operacional de mudancas de status por tenant.

create table if not exists public.pedido_status_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  status_anterior text null,
  status_novo text not null,
  motivo text null,
  alterado_por uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pedido_status_history_account_id on public.pedido_status_history(account_id);
create index if not exists idx_pedido_status_history_pedido_id on public.pedido_status_history(pedido_id);
create index if not exists idx_pedido_status_history_created_at_desc on public.pedido_status_history(created_at desc);

alter table public.pedido_status_history enable row level security;

drop policy if exists pedidos_status_history_authenticated_select on public.pedido_status_history;
drop policy if exists pedidos_status_history_authenticated_insert on public.pedido_status_history;
drop policy if exists pedidos_status_history_authenticated_update on public.pedido_status_history;
drop policy if exists pedidos_status_history_authenticated_delete on public.pedido_status_history;
drop policy if exists pedidos_status_history_service_role_all on public.pedido_status_history;

-- RLS tenant: usuario autenticado so le/escreve registros do seu account_id no JWT.
create policy pedidos_status_history_authenticated_select on public.pedido_status_history
for select to authenticated using (account_id = public.current_account_id());
create policy pedidos_status_history_authenticated_insert on public.pedido_status_history
for insert to authenticated with check (account_id = public.current_account_id());
create policy pedidos_status_history_authenticated_update on public.pedido_status_history
for update to authenticated using (account_id = public.current_account_id()) with check (account_id = public.current_account_id());
create policy pedidos_status_history_authenticated_delete on public.pedido_status_history
for delete to authenticated using (account_id = public.current_account_id());

-- service_role permanece irrestrito para operacoes administrativas/controladas na API.
create policy pedidos_status_history_service_role_all on public.pedido_status_history
for all to service_role using (true) with check (true);

grant all on table public.pedido_status_history to authenticated;
grant all on table public.pedido_status_history to service_role;
