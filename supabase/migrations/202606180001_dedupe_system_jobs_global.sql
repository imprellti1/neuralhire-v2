begin;

create temporary table tmp_system_jobs_canonical (
  nome text primary key,
  lock_key text not null
) on commit drop;

insert into tmp_system_jobs_canonical (nome, lock_key) values
  ('radar_comercial_diario', 'jobs:radar_comercial_diario'),
  ('clientes_enriquecimento_automatico', 'clientes:enriquecimento:automatico'),
  ('clientes_geolocalizacao_automatico', 'clientes:geolocalizacao:automatico'),
  ('notificacoes_resumo_semanal', 'notificacoes:resumo-semanal'),
  ('gerente_comercial_observacao', 'gerente_comercial_observacao');

create temporary table tmp_system_jobs_ranked as
select
  sj.*,
  cj.lock_key as canonical_lock_key,
  row_number() over (
    partition by cj.nome
    order by
      (sj.last_run_at is not null) desc,
      (sj.next_run_at is not null) desc,
      sj.last_run_at desc nulls last,
      sj.next_run_at desc nulls last,
      sj.created_at asc nulls last,
      sj.updated_at asc nulls last,
      sj.id asc
  ) as rn
from public.system_jobs sj
join tmp_system_jobs_canonical cj
  on cj.nome = sj.nome
  or sj.lock_key = cj.lock_key
  or sj.lock_key like cj.nome || ':%'
  or sj.lock_key like '%:' || cj.lock_key;

create temporary table tmp_system_jobs_keep as
select * from tmp_system_jobs_ranked where rn = 1;

update public.system_job_runs sjr
set job_id = keep.id
from tmp_system_jobs_ranked dup
join tmp_system_jobs_keep keep on keep.nome = dup.nome
where sjr.job_id = dup.id
  and dup.rn > 1;

update public.system_jobs sj
set
  lock_key = keep.canonical_lock_key,
  account_id = null,
  nome = keep.nome,
  status = coalesce(sj.status, 'ativo'),
  metadata = coalesce(sj.metadata, '{}'::jsonb)
from tmp_system_jobs_keep keep
where sj.id = keep.id;

delete from public.system_jobs sj
using tmp_system_jobs_ranked dup
where sj.id = dup.id
  and dup.rn > 1;

delete from public.system_job_runs sjr
where sjr.job_id not in (select id from public.system_jobs);

alter table public.system_jobs
  drop constraint if exists system_jobs_lock_key_key;

alter table public.system_jobs
  add constraint system_jobs_lock_key_key unique (lock_key);

create unique index if not exists system_jobs_global_nome_unique on public.system_jobs (nome);

commit;
