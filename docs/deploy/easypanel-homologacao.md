# Deploy EasyPanel / Hostinger - NeuralHire v2

## Visao geral

Este pacote separa a operação em 3 serviços independentes, sem misturar com o sistema antigo:

1. `neuralhire-v2-api`
2. `neuralhire-v2-app`
3. `neuralhire-v2-site`

Domínios:

- `api.neuralhire.com.br`
- `app.neuralhire.com.br`
- `neuralhire.com.br`

## DNS necessário

- `neuralhire.com.br` aponta para o serviço `neuralhire-v2-site`
- `app.neuralhire.com.br` aponta para o serviço `neuralhire-v2-app`
- `api.neuralhire.com.br` aponta para o serviço `neuralhire-v2-api`

Recomendado:

- criar os 3 registros no provedor DNS antes do deploy
- validar propagação antes de ligar o domínio no EasyPanel
- não reutilizar nenhum hostname do sistema antigo

## Serviços EasyPanel

### 1. API

- Serviço: `neuralhire-v2-api`
- Domínio: `api.neuralhire.com.br`
- Porta interna: `3000`
- Dockerfile: `apps/api/Dockerfile`

Build:

```bash
docker build -f apps/api/Dockerfile .
```

Variáveis de ambiente:

```env
NODE_ENV=production
PORT=3000
AUTH_MODE=supabase
SUPABASE_URL=https://qvwbsadesksrhcslmmjg.supabase.co
SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
PUBLIC_INTEREST_ACCOUNT_ID=7b8d9d4f-7c67-4a3f-8c85-5f6d5df1a114
CORS_ORIGIN=https://neuralhire.com.br,https://app.neuralhire.com.br
```

Observações:

- a API aceita `Authorization: Bearer <jwt>`
- o tenant deve ser resolvido por `account_users`
- o `POST /interest-leads` público usa `PUBLIC_INTEREST_ACCOUNT_ID`
- não usar `x-test-*`
- não usar demo ou memory no fluxo real

Health check:

```powershell
Invoke-RestMethod https://api.neuralhire.com.br/health
```

### 2. App interno

- Serviço: `neuralhire-v2-app`
- Domínio: `app.neuralhire.com.br`
- Dockerfile: `apps/web/Dockerfile.app`

Build:

```bash
docker build -f apps/web/Dockerfile.app .
```

Runtime config esperado:

```js
window.__NEURALHIRE_CONFIG__ = {
  VITE_SUPABASE_URL: 'https://qvwbsadesksrhcslmmjg.supabase.co',
  VITE_SUPABASE_ANON_KEY: '<SUPABASE_ANON_KEY>',
  VITE_API_URL: 'https://api.neuralhire.com.br'
};
```

Observações:

- abrir em `https://app.neuralhire.com.br/#/login`
- login real via Supabase
- o app usa a API real em `https://api.neuralhire.com.br`
- não habilitar demo mode
- não habilitar memory mode para homologação real

Health check:

- abrir `https://app.neuralhire.com.br`
- validar que carrega a landing ou redireciona corretamente para o fluxo interno

### 3. Site institucional

- Serviço: `neuralhire-v2-site`
- Domínio: `neuralhire.com.br`
- Dockerfile: `apps/web/Dockerfile.site`

Build:

```bash
docker build -f apps/web/Dockerfile.site .
```

Observações:

- o site público deve servir a landing pública atual
- o formulário de interesse envia `POST /interest-leads` para a API real
- não permitir contratação direta ainda
- comunicar lista de interesse, 15 dias grátis no lançamento, módulos do sistema e agentes comerciais via WhatsApp

Health check:

- abrir `https://neuralhire.com.br`
- enviar o formulário de interesse
- confirmar que o lead chegou ao Supabase

## Checklist pós-deploy

### API

```powershell
Invoke-RestMethod https://api.neuralhire.com.br/health
```

- responder `ok`
- responder com CORS correto para `https://neuralhire.com.br` e `https://app.neuralhire.com.br`
- aceitar JWT real no header `Authorization`
- resolver tenant por `account_users`

### Site

- abrir `https://neuralhire.com.br`
- confirmar que a landing carrega
- preencher e enviar o formulário
- validar lead no Supabase

### App

- abrir `https://app.neuralhire.com.br/#/login`
- login real Supabase
- abrir `#/produtos`
- abrir `#/fabricantes`
- criar fábrica com CNPJ
- recarregar e confirmar persistência no Supabase

## Validações antes de fechar

```powershell
npm.cmd --workspace apps/web run test:web
npm.cmd run check
npm.cmd --workspace apps/api run test:api
npm.cmd run quality
git status
```

## Rollback básico

Se precisar voltar rapidamente:

1. Reverta o serviço do EasyPanel para a imagem anterior.
2. Preserve os registros DNS.
3. Mantenha o banco Supabase intacto.
4. Não reativar `x-test-*`, demo mode ou memory mode no ambiente real.

## Critérios de aceite

- `quality` verde
- documentação criada
- Dockerfiles prontos
- site pronto para `neuralhire.com.br`
- app pronto para `app.neuralhire.com.br`
- API pronta para `api.neuralhire.com.br`
- nenhum `x-test-*` no fluxo real
- nenhuma dependência de demo/memory no fluxo real
- sistema antigo preservado
