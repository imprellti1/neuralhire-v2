create table if not exists public.cliente_timeline (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null,
  categoria text not null,
  titulo text not null,
  descricao text not null,
  referencia_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cliente_timeline_categoria_check check (
    categoria in ('cadastro', 'crm', 'enriquecimento', 'geolocalizacao', 'score', 'alerta', 'pedido', 'visita', 'diretor_ia')
  )
);

create index if not exists cliente_timeline_account_cliente_created_at_idx
  on public.cliente_timeline (account_id, cliente_id, created_at desc);
