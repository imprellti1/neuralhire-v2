insert into storage.buckets (id, name, public)
values ('fabricantes-logos', 'fabricantes-logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "fabricantes-logos select public" on storage.objects;
drop policy if exists "fabricantes-logos upload by account" on storage.objects;
drop policy if exists "fabricantes-logos update by account" on storage.objects;
drop policy if exists "fabricantes-logos delete by account" on storage.objects;

create policy "fabricantes-logos select public"
on storage.objects
for select
to public
using (bucket_id = 'fabricantes-logos');

create policy "fabricantes-logos upload by account"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fabricantes-logos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'account_id', '')
);

create policy "fabricantes-logos update by account"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fabricantes-logos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'account_id', '')
)
with check (
  bucket_id = 'fabricantes-logos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'account_id', '')
);

create policy "fabricantes-logos delete by account"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fabricantes-logos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'account_id', '')
);
