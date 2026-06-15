alter table if exists public.pedidos
  add column if not exists data_emissao date null;

create index if not exists idx_pedidos_data_emissao on public.pedidos (data_emissao);
