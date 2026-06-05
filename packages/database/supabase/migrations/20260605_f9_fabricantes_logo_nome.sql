alter table public.fabricantes
  add column if not exists regiao_atendida text;

update public.fabricantes
set logo_url = null
where logo_url like 'blob:%';
