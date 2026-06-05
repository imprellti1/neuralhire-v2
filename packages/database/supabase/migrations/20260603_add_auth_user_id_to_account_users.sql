alter table public.account_users
add column if not exists auth_user_id uuid;

create index if not exists idx_account_users_auth_user_id
on public.account_users(auth_user_id);

update public.account_users
set auth_user_id = '7dfcb407-28ed-42b0-92da-ca2b25b8675c',
    email = 'imprell.ti1@gmail.com',
    role = 'owner',
    updated_at = now()
where email in ('imprell.ti1@gmail.com', 'homologacao@neuralhire.local')
   or id = '2825b9f5-a039-4d1d-9d12-8df9020cad65';
