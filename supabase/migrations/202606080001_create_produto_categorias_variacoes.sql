-- Produtos v2: categorias hierarquicas, campos comerciais e variacoes reais

create extension if not exists pgcrypto;

create table if not exists public.produto_categorias (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  parent_id uuid null,
  nome text not null,
  slug text not null,
  descricao text null,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produto_categorias_parent_fk foreign key (parent_id) references public.produto_categorias(id) on delete set null,
  constraint produto_categorias_status_check check (status in ('ativo', 'inativo'))
);

create unique index if not exists idx_produto_categorias_account_slug on public.produto_categorias (account_id, slug);
create index if not exists idx_produto_categorias_account_id on public.produto_categorias (account_id);
create index if not exists idx_produto_categorias_parent_id on public.produto_categorias (parent_id);
create index if not exists idx_produto_categorias_status on public.produto_categorias (status);
create index if not exists idx_produto_categorias_created_at_desc on public.produto_categorias (created_at desc);

drop trigger if exists trg_produto_categorias_set_updated_at on public.produto_categorias;
create trigger trg_produto_categorias_set_updated_at
before update on public.produto_categorias
for each row execute function public.set_updated_at();

alter table public.produto_categorias enable row level security;

drop policy if exists "produto_categorias_select_authenticated_tenant" on public.produto_categorias;
create policy "produto_categorias_select_authenticated_tenant"
on public.produto_categorias for select to authenticated
using (account_id = public.current_account_id());

drop policy if exists "produto_categorias_insert_authenticated_tenant" on public.produto_categorias;
create policy "produto_categorias_insert_authenticated_tenant"
on public.produto_categorias for insert to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "produto_categorias_update_authenticated_tenant" on public.produto_categorias;
create policy "produto_categorias_update_authenticated_tenant"
on public.produto_categorias for update to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "produto_categorias_service_role_full_access" on public.produto_categorias;
create policy "produto_categorias_service_role_full_access"
on public.produto_categorias for all to service_role
using (true) with check (true);

grant all on table public.produto_categorias to authenticated;
grant all on table public.produto_categorias to service_role;

alter table public.produtos add column if not exists categoria_id uuid null references public.produto_categorias(id) on delete set null;
alter table public.produtos add column if not exists icms_percentual numeric(6,2) not null default 0;
alter table public.produtos add column if not exists preco_promocional numeric(12,2) null;
alter table public.produtos add column if not exists video_url text null;

create index if not exists idx_produtos_categoria_id on public.produtos (categoria_id);

create table if not exists public.produto_variacoes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  sku text null,
  nome text not null,
  valor text null,
  preco numeric(12,2) not null default 0,
  preco_promocional numeric(12,2) null,
  multiplo_venda numeric(12,3) not null default 1,
  ativo boolean not null default true,
  imagem_url text null,
  imagem_path text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produto_variacoes_account_id on public.produto_variacoes (account_id);
create index if not exists idx_produto_variacoes_produto_id on public.produto_variacoes (produto_id);
create index if not exists idx_produto_variacoes_sku on public.produto_variacoes (sku);

drop trigger if exists trg_produto_variacoes_set_updated_at on public.produto_variacoes;
create trigger trg_produto_variacoes_set_updated_at
before update on public.produto_variacoes
for each row execute function public.set_updated_at();

alter table public.produto_variacoes enable row level security;

drop policy if exists "produto_variacoes_select_authenticated_tenant" on public.produto_variacoes;
create policy "produto_variacoes_select_authenticated_tenant"
on public.produto_variacoes for select to authenticated
using (account_id = public.current_account_id());

drop policy if exists "produto_variacoes_insert_authenticated_tenant" on public.produto_variacoes;
create policy "produto_variacoes_insert_authenticated_tenant"
on public.produto_variacoes for insert to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "produto_variacoes_update_authenticated_tenant" on public.produto_variacoes;
create policy "produto_variacoes_update_authenticated_tenant"
on public.produto_variacoes for update to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "produto_variacoes_delete_authenticated_tenant" on public.produto_variacoes;
create policy "produto_variacoes_delete_authenticated_tenant"
on public.produto_variacoes for delete to authenticated
using (account_id = public.current_account_id());

drop policy if exists "produto_variacoes_service_role_full_access" on public.produto_variacoes;
create policy "produto_variacoes_service_role_full_access"
on public.produto_variacoes for all to service_role
using (true) with check (true);

grant all on table public.produto_variacoes to authenticated;
grant all on table public.produto_variacoes to service_role;

create table if not exists public.produto_imagens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  variacao_id uuid null references public.produto_variacoes(id) on delete cascade,
  url text not null,
  storage_path text not null,
  ordem integer not null default 0,
  principal boolean not null default false,
  tipo text not null default 'image',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produto_imagens_account_id on public.produto_imagens (account_id);
create index if not exists idx_produto_imagens_produto_id on public.produto_imagens (produto_id);
create index if not exists idx_produto_imagens_variacao_id on public.produto_imagens (variacao_id);
create index if not exists idx_produto_imagens_principal on public.produto_imagens (produto_id, variacao_id, principal);

drop trigger if exists trg_produto_imagens_set_updated_at on public.produto_imagens;
create trigger trg_produto_imagens_set_updated_at
before update on public.produto_imagens
for each row execute function public.set_updated_at();

alter table public.produto_imagens enable row level security;

drop policy if exists "produto_imagens_select_authenticated_tenant" on public.produto_imagens;
create policy "produto_imagens_select_authenticated_tenant"
on public.produto_imagens for select to authenticated
using (account_id = public.current_account_id());

drop policy if exists "produto_imagens_insert_authenticated_tenant" on public.produto_imagens;
create policy "produto_imagens_insert_authenticated_tenant"
on public.produto_imagens for insert to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "produto_imagens_update_authenticated_tenant" on public.produto_imagens;
create policy "produto_imagens_update_authenticated_tenant"
on public.produto_imagens for update to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "produto_imagens_delete_authenticated_tenant" on public.produto_imagens;
create policy "produto_imagens_delete_authenticated_tenant"
on public.produto_imagens for delete to authenticated
using (account_id = public.current_account_id());

drop policy if exists "produto_imagens_service_role_full_access" on public.produto_imagens;
create policy "produto_imagens_service_role_full_access"
on public.produto_imagens for all to service_role
using (true) with check (true);

grant all on table public.produto_imagens to authenticated;
grant all on table public.produto_imagens to service_role;
