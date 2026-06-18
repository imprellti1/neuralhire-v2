create or replace function public.find_ai_director_executive_memory_by_logical_key(
  p_account_id uuid,
  p_tipo text,
  p_categoria text,
  p_origem text,
  p_titulo text
)
returns setof public.ai_director_executive_memories
language sql
stable
as $$
  select *
  from public.ai_director_executive_memories
  where account_id = p_account_id
    and tipo = p_tipo
    and categoria = p_categoria
    and origem = p_origem
    and lower(titulo) = lower(p_titulo)
  limit 1;
$$;
