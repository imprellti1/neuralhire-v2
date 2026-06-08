alter table public.fabricantes
  add column if not exists pedido_minimo_valor numeric default 0,
  add column if not exists pedido_minimo_itens integer default 0,
  add column if not exists prazo_entrega_dias integer default 0,
  add column if not exists aceita_bonificacao boolean default false,
  add column if not exists aceita_consignacao boolean default false,
  add column if not exists politica_troca text,
  add column if not exists condicoes_pagamento text,
  add column if not exists observacoes_comerciais text,
  add column if not exists tabela_precos_url text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fabricantes'
      and column_name = 'pedido_minimo'
  ) then
    update public.fabricantes
       set pedido_minimo_valor = coalesce(pedido_minimo_valor, pedido_minimo, 0)
     where pedido_minimo_valor is null and pedido_minimo is not null;
  end if;
exception
  when others then null;
end $$;

alter table public.fabricantes
  add constraint fabricantes_pedido_minimo_valor_check check (pedido_minimo_valor is null or pedido_minimo_valor >= 0),
  add constraint fabricantes_pedido_minimo_itens_check check (pedido_minimo_itens is null or pedido_minimo_itens >= 0),
  add constraint fabricantes_prazo_entrega_dias_check check (prazo_entrega_dias is null or prazo_entrega_dias >= 0),
  add constraint fabricantes_comissao_padrao_percentual_check check (comissao_padrao_percentual is null or (comissao_padrao_percentual >= 0 and comissao_padrao_percentual <= 100));
