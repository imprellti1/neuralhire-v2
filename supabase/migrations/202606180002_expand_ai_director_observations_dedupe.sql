alter table public.ai_director_observations
  add column if not exists impact text null,
  add column if not exists urgency text null,
  add column if not exists origin text not null default 'manual';

update public.ai_director_observations
set
  impact = coalesce(impact, null),
  urgency = coalesce(urgency, null),
  origin = coalesce(origin, source_type, 'manual');

create unique index if not exists ai_director_observations_open_dedupe_idx
  on public.ai_director_observations (account_id, manager_id, category, title, origin)
  where status = 'open';
