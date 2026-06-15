-- Auditoria de pedidos: campos de comissao e compatibilidade com faturamento

alter table if exists public.pedidos
  add column if not exists comissao_principal_percentual numeric(5,2) null,
  add column if not exists comissao_preposto_percentual numeric(5,2) null;

alter table if exists public.pedidos
  add column if not exists data_faturamento date null;

alter table if exists public.pedidos
  alter column comissao_principal_percentual drop not null;

alter table if exists public.pedidos
  alter column comissao_preposto_percentual drop not null;
