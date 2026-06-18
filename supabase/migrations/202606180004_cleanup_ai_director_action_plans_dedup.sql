create extension if not exists pgcrypto;

create or replace function public.normalize_ai_director_action_plan_title_key(value text)
returns text
language sql
immutable
as $fn$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        lower(coalesce(value, '')),
                        'á|à|â|ã|ä|å',
                        'a',
                        'g'
                      ),
                      'é|è|ê|ë',
                      'e',
                      'g'
                    ),
                    'í|ì|î|ï',
                    'i',
                    'g'
                  ),
                  'ó|ò|ô|õ|ö',
                  'o',
                  'g'
                ),
                'ú|ù|û|ü',
                'u',
                'g'
              ),
              'ç',
              'c',
              'g'
            ),
            '[^[:alnum:][:space:]]+',
            ' ',
            'g'
          ),
          '\s+',
          ' ',
          'g'
        ),
        '^\s+|\s+$',
        '',
        'g'
      ),
      '\s+',
      '_',
      'g'
    ),
    ''
  );
$fn$;

with normalized as (
  select
    id,
    account_id,
    titulo,
    prioridade_score,
    criado_em,
    updated_at,
    status,
    metadata,
    coalesce(
      nullif(trim(metadata ->> 'normalized_title_key'), ''),
      public.normalize_ai_director_action_plan_title_key(titulo)
    ) as computed_title_key
  from public.ai_director_action_plans
),
updated_metadata as (
  update public.ai_director_action_plans plan
     set metadata = jsonb_set(
       coalesce(plan.metadata, '{}'::jsonb),
       '{normalized_title_key}',
       to_jsonb(normalized.computed_title_key),
       true
     ),
         updated_at = now()
    from normalized
   where plan.id = normalized.id
     and plan.status = 'aberto'
     and (
       plan.metadata ->> 'normalized_title_key' is null
       or trim(plan.metadata ->> 'normalized_title_key') = ''
     )
     and normalized.computed_title_key is not null
  returning plan.id
),
ranked as (
  select
    p.id,
    p.account_id,
    p.status,
    p.prioridade_score,
    p.criado_em,
    p.updated_at,
    p.metadata,
    coalesce(nullif(trim(p.metadata ->> 'normalized_title_key'), ''), public.normalize_ai_director_action_plan_title_key(p.titulo)) as normalized_title_key,
    row_number() over (
      partition by p.account_id, coalesce(nullif(trim(p.metadata ->> 'normalized_title_key'), ''), public.normalize_ai_director_action_plan_title_key(p.titulo))
      order by coalesce(p.prioridade_score, 0) desc, coalesce(p.criado_em, p.updated_at, now()) desc, p.id desc
    ) as rn,
    first_value(p.id) over (
      partition by p.account_id, coalesce(nullif(trim(p.metadata ->> 'normalized_title_key'), ''), public.normalize_ai_director_action_plan_title_key(p.titulo))
      order by coalesce(p.prioridade_score, 0) desc, coalesce(p.criado_em, p.updated_at, now()) desc, p.id desc
    ) as kept_id
  from public.ai_director_action_plans p
  where p.status = 'aberto'
)
update public.ai_director_action_plans plan
   set status = 'cancelado',
       updated_at = now(),
       metadata = jsonb_set(
         jsonb_set(
           coalesce(plan.metadata, '{}'::jsonb),
           '{cancelled_by}',
           to_jsonb('dedupe_cleanup'::text),
           true
         ),
         '{replaced_by_action_plan_id}',
         to_jsonb(ranked.kept_id),
         true
       )
  from ranked
 where plan.id = ranked.id
   and ranked.rn > 1
   and ranked.normalized_title_key is not null;

create unique index if not exists ai_director_action_plans_open_executive_memory_unique_idx
  on public.ai_director_action_plans (account_id, executive_memory_id)
  where status = 'aberto';

create unique index if not exists ai_director_action_plans_open_normalized_title_key_unique_idx
  on public.ai_director_action_plans (account_id, ((metadata ->> 'normalized_title_key')))
  where status = 'aberto' and (metadata ->> 'normalized_title_key') is not null;
