create table if not exists public.cliente_alertas (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null,
  severidade text not null,
  titulo text not null,
  descricao text not null,
  status text not null default 'ativo',
  metadata jsonb not null default '{}'::jsonb,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  constraint cliente_alertas_status_check check (status in ('ativo', 'resolvido', 'ignorado')),
  constraint cliente_alertas_severidade_check check (severidade in ('baixa', 'media', 'alta', 'critica')),
  constraint cliente_alertas_tipo_unique unique (account_id, cliente_id, tipo)
);

create index if not exists cliente_alertas_account_cliente_status_idx
  on public.cliente_alertas (account_id, cliente_id, status, created_at desc);
