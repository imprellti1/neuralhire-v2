# Homologação M1.13

## Objetivo
Usar autenticação real do Supabase em homologação, com `Authorization: Bearer <token>` no WEB e validação JWT real na API.

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

## Conta de homologação
- Nome da conta: `NeuralHire Homologação`
- Usuário: um gestor/owner real do Supabase Auth
- Associação: o usuário deve existir em `account_users` ou tabela equivalente com `account_id`, `user_id` e `role`
- Role sugerida: `owner` ou `manager`

## Seed mínimo seguro
Criar dados fictícios e não sensíveis:
- produtos
- fábricas
- clientes fictícios
- pedidos fictícios
- configurações comerciais

## Checklist de teste
- login real no Supabase funciona
- `#/product-editor` abre após login
- `Authorization: Bearer <token>` aparece nas chamadas
- `GET /product-editor/products` resolve `accountId` a partir do JWT/membership
- outro usuário de outra conta não acessa dados alheios
- `x-test-*` não é necessário em homologação

## Como desligar o modo demo
- Não publicar `VITE_DEMO_ACCOUNT_ID`
- Não publicar `VITE_DEMO_ROLE`
- Não publicar `VITE_DEMO_USER_ID`
- Manter `AUTH_MODE=supabase` em homologação
- Restringir `x-test-*` apenas a testes locais/automatizados
