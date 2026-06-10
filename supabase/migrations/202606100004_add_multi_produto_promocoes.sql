create table if not exists public.produto_promocao_produtos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  promocao_id uuid not null references public.produto_promocoes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id),
  aplicar_em_todas_variacoes boolean not null default true,
  percentual_desconto numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, promocao_id, produto_id)
);

alter table if exists public.produto_promocao_variacoes
  add column if not exists promocao_produto_id uuid null references public.produto_promocao_produtos (id) on delete cascade,
  add column if not exists produto_id uuid;

update public.produto_promocao_variacoes v
set produto_id = coalesce(v.produto_id, p.produto_id)
from public.produto_promocoes p
where v.promocao_id = p.id
  and v.produto_id is null;

update public.produto_promocao_variacoes v
set promocao_produto_id = pp.id
from public.produto_promocao_produtos pp
where v.promocao_id = pp.promocao_id
  and v.produto_id = pp.produto_id
  and v.promocao_produto_id is null;

create index if not exists idx_produto_promocao_produtos_account_id on public.produto_promocao_produtos (account_id);
create index if not exists idx_produto_promocao_produtos_promocao_id on public.produto_promocao_produtos (promocao_id);
create index if not exists idx_produto_promocao_produtos_produto_id on public.produto_promocao_produtos (produto_id);
create index if not exists idx_produto_promocao_variacoes_promocao_produto_id on public.produto_promocao_variacoes (promocao_produto_id);
create index if not exists idx_produto_promocao_variacoes_produto_id on public.produto_promocao_variacoes (produto_id);
create index if not exists idx_produto_promocao_variacoes_variacao_id on public.produto_promocao_variacoes (variacao_id);
