alter table public.pedido_itens
  alter column produto_id drop not null;

alter table public.pedido_itens
  add column if not exists variacao_id uuid null references public.produto_variacoes(id);

alter table public.pedido_itens
  add column if not exists codigo_produto_erp_original text null,
  add column if not exists nome_produto_original text null,
  add column if not exists cor_original text null,
  add column if not exists tamanho_original text null,
  add column if not exists ean_original text null,
  add column if not exists valor_unitario numeric(12,2) null,
  add column if not exists valor_total numeric(12,2) null,
  add column if not exists status_vinculo text not null default 'nao_encontrado',
  add column if not exists motivo_vinculo text null,
  add column if not exists sku_base_extraido text null,
  add column if not exists sku_esperado text null;

alter table public.pedido_itens
  drop constraint if exists pedido_itens_status_vinculo_check;

alter table public.pedido_itens
  add constraint pedido_itens_status_vinculo_check
  check (status_vinculo in ('vinculado', 'nao_encontrado', 'ambiguo'));

alter table public.pedido_itens
  drop constraint if exists pedido_itens_quantidade_check;

alter table public.pedido_itens
  add constraint pedido_itens_quantidade_check
  check (quantidade >= 0);

alter table public.pedido_itens
  drop constraint if exists pedido_itens_valor_unitario_check;

alter table public.pedido_itens
  add constraint pedido_itens_valor_unitario_check
  check (valor_unitario is null or valor_unitario >= 0);

alter table public.pedido_itens
  drop constraint if exists pedido_itens_valor_total_check;

alter table public.pedido_itens
  add constraint pedido_itens_valor_total_check
  check (valor_total is null or valor_total >= 0);

create index if not exists idx_pedido_itens_account_pedido on public.pedido_itens (account_id, pedido_id);
create index if not exists idx_pedido_itens_account_produto on public.pedido_itens (account_id, produto_id);
create index if not exists idx_pedido_itens_account_variacao on public.pedido_itens (account_id, variacao_id);
create index if not exists idx_pedido_itens_account_status_vinculo on public.pedido_itens (account_id, status_vinculo);
