alter table public.clientes
  add column if not exists cliente_score integer,
  add column if not exists cliente_classificacao text,
  add column if not exists cliente_potencial text,
  add column if not exists cliente_score_ultima_execucao timestamptz,
  add column if not exists cliente_score_fatores jsonb;

alter table public.clientes
  drop constraint if exists clientes_cliente_score_check;
alter table public.clientes
  add constraint clientes_cliente_score_check
  check (cliente_score is null or cliente_score between 0 and 100);

alter table public.clientes
  drop constraint if exists clientes_cliente_classificacao_check;
alter table public.clientes
  add constraint clientes_cliente_classificacao_check
  check (cliente_classificacao is null or cliente_classificacao in ('A', 'B', 'C', 'D'));

alter table public.clientes
  drop constraint if exists clientes_cliente_potencial_check;
alter table public.clientes
  add constraint clientes_cliente_potencial_check
  check (cliente_potencial is null or cliente_potencial in ('Alto', 'Médio', 'Baixo'));
