create extension if not exists pgcrypto;

create table if not exists public.produto_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  fabricante_id uuid not null,
  arquivo_nome text null,
  status text not null default 'pending',
  total_linhas integer not null default 0,
  linhas_processadas integer not null default 0,
  produtos_criados integer not null default 0,
  produtos_atualizados integer not null default 0,
  variacoes_criadas integer not null default 0,
  variacoes_atualizadas integer not null default 0,
  estoques_atualizados integer not null default 0,
  erros integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.produto_variacao_estoques (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  variacao_id uuid not null references public.produto_variacoes(id) on delete cascade,
  fabricante_id uuid not null,
  quantidade numeric(12,3) not null default 0,
  origem text null,
  arquivo_origem text null,
  import_batch_id uuid null references public.produto_import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

