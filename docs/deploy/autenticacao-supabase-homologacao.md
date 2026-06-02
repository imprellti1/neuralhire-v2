# Autenticação Supabase em Homologação

## Objetivo
Usar autenticação real do Supabase em homologação com JWT real, `Authorization: Bearer <token>` e vínculo real de usuário com `account_id`.

## Fluxo oficial
1. O usuário é criado no Supabase Auth pelo painel.
2. A conta `NeuralHire Homologação` é criada na tabela `public.accounts`.
3. O vínculo real entre usuário e conta é gravado em `public.account_users`.
4. O frontend autentica via Supabase Auth.
5. A sessão é salva localmente no navegador.
6. O `api-client` envia `Authorization: Bearer <access_token>`.
7. A API valida o JWT no Supabase, resolve `accountId` via membership e segue com contexto autenticado.

## Tabelas reais usadas
- `public.accounts`
- `public.account_users`
- `public.fabricantes`
- `public.produtos`
- `public.clientes`
- `public.pedidos`
- `public.pedido_itens`

## Seed seguro
Arquivo:
- [packages/database/supabase/seeds/20260602_seed_homologacao_neuralhire.sql](/C:/Users/Meu%20Computador/Meu%20Drive/PROGRAMA%C3%87%C3%83O/NEURAL%20HIRE/packages/database/supabase/seeds/20260602_seed_homologacao_neuralhire.sql)

O seed:
- cria `NeuralHire Homologação`
- usa `slug = neuralhire-homologacao`
- define `status = active`
- cria 3 fabricantes fictícios
- cria 5 produtos fictícios
- cria 3 clientes fictícios
- cria 3 pedidos fictícios
- cria itens de pedido vinculados

## Execução do seed

### SQL Editor do Supabase
1. Criar o usuário em Authentication > Users.
2. Copiar o `auth.users.id` do usuário.
3. Substituir o valor de `homologacao_auth_user_id` no seed ou executar este bloco antes do restante do script:

```sql
select set_config(
  'neuralhire.homologacao_auth_user_id',
  '<auth.users.id>',
  false
);
```

4. Executar o arquivo completo no SQL Editor.

### psql
```bash
psql "$DATABASE_URL" -f packages/database/supabase/seeds/20260602_seed_homologacao_neuralhire.sql
```

Se preferir usar sessão explícita:

```sql
select set_config(
  'neuralhire.homologacao_auth_user_id',
  '<auth.users.id>',
  false
);
```

### Supabase CLI
```bash
supabase db reset
supabase db seed
```

Ou, para executar apenas este arquivo em ambiente controlado, usar o fluxo de seed definido pelo projeto apontando para `packages/database/supabase/seeds/20260602_seed_homologacao_neuralhire.sql`.

## Como vincular o usuário real
O SQL não deve criar `auth.users` diretamente.

Passo a passo recomendado:
1. Criar o usuário no painel do Supabase Auth.
2. Copiar o `auth.users.id` do usuário de homologação.
3. Executar o seed na mesma sessão SQL definindo o GUC abaixo ou substituindo a variável local no script:

```sql
select set_config(
  'neuralhire.homologacao_auth_user_id',
  '<auth.users.id>',
  false
);
```

4. Rodar o seed.

Se o usuário Auth ainda não existir, o script deve falhar de forma explícita.

## Resolução de `accountId`
Na API, o middleware de auth resolve `accountId` nesta ordem:
1. membership real via `public.account_users`
2. `user.app_metadata.account_id`
3. `user.app_metadata.accountId`
4. `user.user_metadata.account_id`
5. `user.user_metadata.accountId`

O fallback `x-test-*` não faz parte do fluxo de homologação.

## Variáveis de ambiente
### WEB
- `VITE_APP_ENV=homologation`
- `VITE_API_URL=https://api-v2.neuralhire.com.br`
- `VITE_SUPABASE_URL=<supabase_url>`
- `VITE_SUPABASE_ANON_KEY=<supabase_anon_key>`

### API
- `APP_ENV=homologation`
- `AUTH_MODE=supabase`
- `SUPABASE_URL=<supabase_url>`
- `SUPABASE_ANON_KEY=<supabase_anon_key>`
- `SUPABASE_SERVICE_ROLE_KEY=<service_role_key>`

## Checklist de validação
- login real no Supabase funciona
- `#/product-editor` abre após login
- chamadas saem com `Authorization: Bearer <token>`
- a API resolve `accountId` real pelo vínculo em `account_users`
- `GET /product-editor/products` retorna somente dados da conta de homologação
- `x-test-*` não é necessário em homologação

## Segurança
- não gravar `service_role`, `anon key` ou senha em arquivo
- não commitar segredos
- não usar dados reais de clientes finais
