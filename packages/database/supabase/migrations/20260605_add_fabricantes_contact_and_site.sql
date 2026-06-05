alter table public.fabricantes
  add column if not exists site text,
  add column if not exists email_comercial text,
  add column if not exists telefone text,
  add column if not exists regiao_atendida text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists cep text,
  add column if not exists endereco_completo text;
