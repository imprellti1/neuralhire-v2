alter table public.clientes
  add column if not exists latitude numeric(10,8),
  add column if not exists longitude numeric(11,8),
  add column if not exists google_maps_url text,
  add column if not exists google_place_id text,
  add column if not exists geolocalizacao_status text,
  add column if not exists geolocalizacao_fonte text,
  add column if not exists geolocalizacao_erro text,
  add column if not exists geolocalizacao_ultima_execucao timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'clientes_geolocalizacao_status_check'
  ) then
    alter table public.clientes drop constraint clientes_geolocalizacao_status_check;
  end if;
end $$;

alter table public.clientes
  add constraint clientes_geolocalizacao_status_check
  check (
    geolocalizacao_status is null
    or geolocalizacao_status in ('pendente', 'sucesso', 'nao_encontrado', 'erro')
  );
