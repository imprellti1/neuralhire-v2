create unique index if not exists ai_director_action_plans_open_executive_memory_unique_idx
  on public.ai_director_action_plans (account_id, executive_memory_id)
  where status = 'aberto';

create unique index if not exists ai_director_action_plans_open_normalized_title_key_unique_idx
  on public.ai_director_action_plans (account_id, ((metadata ->> 'normalized_title_key')))
  where status = 'aberto' and (metadata ->> 'normalized_title_key') is not null;
