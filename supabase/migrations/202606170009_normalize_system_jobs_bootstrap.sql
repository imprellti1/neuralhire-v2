begin;

do $$
declare
  v_now timestamptz := now();
begin
  create temporary table tmp_system_jobs_canonical (nome text primary key, lock_key text not null) on commit drop;

  insert into tmp_system_jobs_canonical (nome, lock_key)
  values
    ('radar_comercial_diario', 'jobs:radar_comercial_diario'),
    ('clientes_enriquecimento_automatico', 'clientes:enriquecimento:automatico'),
    ('clientes_geolocalizacao_automatico', 'clientes:geolocalizacao:automatico'),
    ('notificacoes_resumo_semanal', 'notificacoes:resumo-semanal'),
    ('gerente_comercial_observacao', 'gerente_comercial_observacao');

  with ranked_jobs as (
    select
      sj.id,
      sj.nome,
      sj.lock_key,
      sj.account_id,
      sj.created_at,
      row_number() over (partition by sj.nome order by sj.created_at asc, sj.id asc) as rn
    from public.system_jobs sj
    join tmp_system_jobs_canonical cj on cj.nome = sj.nome
  ),
  duplicate_jobs as (
    select id
      from ranked_jobs
     where rn > 1
       and not exists (
         select 1
           from public.system_job_runs sjr
          where sjr.job_id = ranked_jobs.id
       )
  )
  delete from public.system_jobs sj
  using duplicate_jobs dj
  where sj.id = dj.id;

  with ranked_jobs as (
    select
      sj.id,
      sj.nome,
      sj.lock_key,
      sj.account_id,
      sj.created_at,
      cj.lock_key as canonical_lock_key,
      row_number() over (partition by sj.nome order by sj.created_at asc, sj.id asc) as rn
    from public.system_jobs sj
    join tmp_system_jobs_canonical cj on cj.nome = sj.nome
  )
  update public.system_jobs
     set account_id = null,
         lock_key = ranked_jobs.canonical_lock_key,
         status = 'ativo',
         updated_at = v_now
    from ranked_jobs
   where public.system_jobs.id = ranked_jobs.id
     and ranked_jobs.rn = 1
     and (public.system_jobs.account_id is not null or public.system_jobs.lock_key is distinct from ranked_jobs.canonical_lock_key);

  update public.system_jobs
     set status = 'ativo'
   where nome in (select nome from tmp_system_jobs_canonical);

  drop table if exists tmp_system_jobs_canonical;
end $$;

alter table public.system_jobs
  drop constraint if exists system_jobs_lock_key_key;

alter table public.system_jobs
  add constraint system_jobs_lock_key_key unique (lock_key);

commit;
