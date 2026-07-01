alter table public.clientes
  add column if not exists site text,
  add column if not exists digital_enrichment_status text,
  add column if not exists digital_enrichment_updated_at timestamptz,
  add column if not exists digital_enrichment_payload jsonb not null default '{}'::jsonb;
