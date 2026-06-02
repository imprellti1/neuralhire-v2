# Homologacao M1 - NeuralHire v2

## Servicos

- API: `neuralhire-v2-api`
- WEB: `neuralhire-v2-web`

## Build Paths no EasyPanel

- API build path: `apps/api`
- WEB build path: `apps/web`

## Dominios

- API: `api-v2.neuralhire.com.br`
- WEB: `v2.neuralhire.com.br`

## Portas

- Porta interna da API: `3000`
- Porta interna da WEB: `80`

## Variaveis de ambiente

### API

- `NODE_ENV=production`
- `API_PORT=3000`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `ASAAS_ENV`
- `ASAAS_API_KEY`
- `ASAAS_ALLOW_PRODUCTION`

### WEB

- `VITE_API_URL=https://api-v2.neuralhire.com.br`
- `VITE_APP_ENV=homologation`
- `VITE_DEMO_ACCOUNT_ID=acc-analytics-001`
- `VITE_DEMO_ROLE=manager`
- `VITE_DEMO_USER_ID=user-demo-manager`

## Checklist pos-deploy

- Confirmar que a API sobe em `3000` e responde no dominio `api-v2.neuralhire.com.br`.
- Confirmar que a web abre em `v2.neuralhire.com.br` e chama a API de homologacao.
- Verificar que nenhum segredo local foi copiado para a imagem.
- Validar que o app atual de producao em `neuralhire.com.br` nao foi alterado.
- Testar rotas internas da web depois do deploy.
- Conferir logs iniciais da API para validar `NODE_ENV=production`.
