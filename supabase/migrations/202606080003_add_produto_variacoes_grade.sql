alter table public.produto_variacoes add column if not exists grade text null;
create unique index if not exists idx_produto_variacoes_unique_grade on public.produto_variacoes (account_id, produto_id, nome, grade);
