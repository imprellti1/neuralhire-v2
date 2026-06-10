create table if not exists public.produto_promocoes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  produto_id uuid not null,
  nome text not null,
  descricao text null,
  percentual_desconto numeric not null,
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'ativo',
  aplicar_em_todas_variacoes boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.produto_promocao_variacoes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  promocao_id uuid not null,
  produto_id uuid not null,
  variacao_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_produto_promocoes_account_id on public.produto_promocoes (account_id);
create index if not exists idx_produto_promocoes_produto_id on public.produto_promocoes (produto_id);
create index if not exists idx_produto_promocoes_status on public.produto_promocoes (status);
create index if not exists idx_produto_promocoes_periodo on public.produto_promocoes (data_inicio, data_fim);
create index if not exists idx_produto_promocao_variacoes_account_id on public.produto_promocao_variacoes (account_id);
create index if not exists idx_produto_promocao_variacoes_produto_id on public.produto_promocao_variacoes (produto_id);
create index if not exists idx_produto_promocao_variacoes_promocao_id on public.produto_promocao_variacoes (promocao_id);
create index if not exists idx_produto_promocao_variacoes_variacao_id on public.produto_promocao_variacoes (variacao_id);

