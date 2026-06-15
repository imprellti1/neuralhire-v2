alter table public.pedidos
  add column if not exists vendedor_id uuid null references public.vendedores(id);

create index if not exists idx_pedidos_vendedor_id on public.pedidos (vendedor_id);
create index if not exists idx_pedidos_account_vendedor on public.pedidos (account_id, vendedor_id);
