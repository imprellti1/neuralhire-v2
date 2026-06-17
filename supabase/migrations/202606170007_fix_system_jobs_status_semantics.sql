update public.system_jobs
set status = 'ativo'
where status in ('success', 'error', 'running', 'idle');

alter table public.system_jobs
drop constraint if exists system_jobs_status_check;

alter table public.system_jobs
add constraint system_jobs_status_check
check (status in ('ativo', 'inativo'));
