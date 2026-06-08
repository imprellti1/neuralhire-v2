-- ETAPA PRODUTOS POR FABRICA 1: vincula produtos a fabricantes reais

alter table public.produtos
  add column if not exists fabricante_id uuid null;

do $$
begin
  alter table public.produtos
    add constraint produtos_fabricante_id_fkey
    foreign key (fabricante_id) references public.fabricantes(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_produtos_fabricante_id on public.produtos (fabricante_id);
create index if not exists idx_produtos_account_fabricante on public.produtos (account_id, fabricante_id);

create or replace function public.validate_produtos_fabricante_account()
returns trigger
language plpgsql
as $$
declare
  fabricante_account uuid;
begin
  if new.fabricante_id is null then
    return new;
  end if;

  select f.account_id into fabricante_account
  from public.fabricantes f
  where f.id = new.fabricante_id;

  if fabricante_account is null then
    raise exception 'Fabricante nao encontrado';
  end if;

  if fabricante_account <> new.account_id then
    raise exception 'Fabricante deve pertencer a mesma conta';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_produtos_validate_fabricante_account on public.produtos;
create trigger trg_produtos_validate_fabricante_account
before insert or update on public.produtos
for each row execute function public.validate_produtos_fabricante_account();
