alter table public.produtos
add column if not exists multiplo_venda integer not null default 1;

do $$
begin
  alter table public.produtos
    add constraint produtos_multiplo_venda_check
    check (multiplo_venda >= 1);
exception
  when duplicate_object then null;
end $$;
