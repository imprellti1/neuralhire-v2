alter table public.clientes
  add column if not exists segmento_comercial text,
  add column if not exists segmento_ultima_atualizacao timestamptz,
  add column if not exists segmento_motivos jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'clientes_segmento_comercial_check'
  ) then
    alter table public.clientes drop constraint clientes_segmento_comercial_check;
  end if;
end $$;

alter table public.clientes
  add constraint clientes_segmento_comercial_check
  check (
    segmento_comercial is null
    or segmento_comercial in ('VIP', 'EM_RISCO', 'RECUPERACAO', 'POTENCIAL', 'RECORRENTE', 'NOVO', 'INATIVO')
  );
