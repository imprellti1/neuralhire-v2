# Jornada Comercial E2E (ETAPA 60A)

Fluxo consolidado: Landing publica -> Lista de interesse -> CRM de leads -> Template/preview de lancamento -> Conversao do lead -> Account + admin/account_user -> Trial de 15 dias -> Billing mock/sandbox -> Onboarding start/step/complete.

## Mock/Sandbox
- Billing usa modo mock/sandbox nesta etapa.
- Nao ha cobranca real.
- Nao ha integracao de pagamento real.
- Preview de lancamento nao envia WhatsApp real nem e-mail real.

## Endpoints participantes
- `POST /interest-leads`
- `GET /interest-leads`
- `GET /interest-leads/:id`
- `POST /interest-leads/:id/convert`
- `POST /launch/templates`
- `GET /launch/templates`
- `POST /launch/preview`
- `POST /accounts/:accountId/subscription/prepare`
- `GET /accounts/:accountId/subscription`
- `POST /accounts/:accountId/onboarding/start`
- `PATCH /accounts/:accountId/onboarding/step`
- `POST /accounts/:accountId/onboarding/complete`

## Testes que protegem o fluxo
API:
- `apps/api/src/testing/tests/jornada-comercial-e2e.test.js`
- `apps/api/src/testing/tests/lead-to-account-trial.test.js`
- `apps/api/src/testing/tests/billing-onboarding-integration.test.js`

Web:
- `apps/web/src/modules/public-site/landing-to-lead.integration.test.js`
- `apps/web/src/modules/interest-leads/interest-lead-conversion.integration.test.js`
- `apps/web/src/modules/onboarding/onboarding.integration.test.js`
- `apps/web/src/testing/jornada-comercial.routes.smoke.test.js`

## Pronto para staging quando
- `npm.cmd run test:web` passar.
- `npm.cmd run check` passar.
- `npm.cmd run test:api` passar.
- `npm.cmd run test:all` passar.
- `npm.cmd run quality` passar.
- Sem campos sensiveis (`account_id`, `tenant_id`, `owner_user_id`) no transporte frontend.
