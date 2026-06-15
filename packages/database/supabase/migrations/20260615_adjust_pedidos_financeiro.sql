-- Ajuste do modelo financeiro de pedidos

alter table if exists public.pedidos
  add column if not exists data_faturamento date null;

alter table if exists public.pedidos
  drop column if exists subtotal;

alter table if exists public.pedidos
  drop column if exists desconto;
