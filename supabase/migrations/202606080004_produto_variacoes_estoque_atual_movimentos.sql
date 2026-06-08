alter table public.produto_variacoes add column if not exists cor text null;
alter table public.produto_variacoes add column if not exists grade text null;
alter table public.produto_variacoes add column if not exists estoque_atual numeric(12,3) not null default 0;
alter table public.produto_variacoes add column if not exists imagem_principal_url text null;

create table if not exists public.produto_variacao_movimentos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  variacao_id uuid not null references public.produto_variacoes(id) on delete cascade,
  fabricante_id uuid not null,
  tipo text not null,
  quantidade numeric(12,3) not null,
  saldo_anterior numeric(12,3) not null,
  saldo_posterior numeric(12,3) not null,
  origem text null,
  arquivo_origem text null,
  import_batch_id uuid null,
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produto_variacao_movimentos_tipo_check check (tipo in ('IMPORTACAO_ESTOQUE', 'AJUSTE_MANUAL', 'PEDIDO', 'DEVOLUCAO'))
);

create index if not exists idx_produto_variacao_movimentos_account on public.produto_variacao_movimentos (account_id);
create index if not exists idx_produto_variacao_movimentos_variacao on public.produto_variacao_movimentos (variacao_id, created_at desc);
