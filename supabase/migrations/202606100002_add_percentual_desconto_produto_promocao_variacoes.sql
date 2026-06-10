alter table if exists public.produto_promocao_variacoes
  add column if not exists percentual_desconto numeric null;
