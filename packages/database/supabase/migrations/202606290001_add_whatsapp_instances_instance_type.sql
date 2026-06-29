alter table public.whatsapp_instances
  add column if not exists instance_type text;

update public.whatsapp_instances
set instance_type = coalesce(metadata->>'instance_type', metadata->>'type', 'operational')
where instance_type is null;

alter table public.whatsapp_instances
  alter column instance_type set default 'operational';

alter table public.whatsapp_instances
  alter column instance_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_instances_instance_type_check'
      and conrelid = 'public.whatsapp_instances'::regclass
  ) then
    alter table public.whatsapp_instances
      add constraint whatsapp_instances_instance_type_check
      check (instance_type in ('operational', 'learning'));
  end if;
end;
$$;

create index if not exists idx_whatsapp_instances_provider_instance_name_instance_type
  on public.whatsapp_instances (provider, instance_name, instance_type);
