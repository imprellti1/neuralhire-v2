create extension if not exists pgcrypto;

create table if not exists public.fabricantes (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  nome text not null,
  razao_social text,
  cnpj text,
  logo_url text,
  status text not null default 'ativo',
  pedido_minimo numeric default 0,
  boleto_minimo numeric default 0,
  comissao_padrao_percentual numeric default 0,
  prazo_maximo_dias integer,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint fabricantes_status_check check (status in ('ativo', 'inativo'))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fabricantes_account_cnpj_unique'
  ) then
    alter table public.fabricantes add constraint fabricantes_account_cnpj_unique unique (account_id, cnpj);
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists fabricantes_account_id_idx on public.fabricantes (account_id);
create index if not exists fabricantes_cnpj_idx on public.fabricantes (cnpj);
create index if not exists fabricantes_status_idx on public.fabricantes (status);
create index if not exists fabricantes_nome_idx on public.fabricantes (nome);

create table if not exists public.fabricante_condicoes_pagamento (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  fabricante_id uuid not null references public.fabricantes (id) on delete cascade,
  nome text not null,
  codigo text,
  parcelas integer default 1,
  prazo_medio_dias integer,
  valor_minimo numeric default 0,
  percentual_acrescimo numeric default 0,
  ativo boolean default true,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists fabricante_condicoes_pagamento_account_id_idx on public.fabricante_condicoes_pagamento (account_id);
create index if not exists fabricante_condicoes_pagamento_fabricante_id_idx on public.fabricante_condicoes_pagamento (fabricante_id);
create index if not exists fabricante_condicoes_pagamento_ativo_idx on public.fabricante_condicoes_pagamento (ativo);
create index if not exists fabricante_condicoes_pagamento_codigo_idx on public.fabricante_condicoes_pagamento (codigo);

alter table public.fabricantes enable row level security;
alter table public.fabricante_condicoes_pagamento enable row level security;
