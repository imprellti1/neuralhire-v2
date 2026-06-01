# Supabase Production Checklist — NeuralHire v2

## Objetivo

Validar requisitos mínimos de segurança, isolamento de dados e operação antes de qualquer deploy manual em produção.

## Checklist

- [ ] Confirmar projeto Supabase de produção selecionado corretamente.
- [ ] Confirmar migrations aplicadas no projeto de produção.
- [ ] Confirmar RLS habilitado nas tabelas multi-tenant.
- [ ] Confirmar policies com isolamento por `account_id`.
- [ ] Confirmar regras de ownership por vendedor onde aplicável.
- [ ] Confirmar uso correto de papéis `authenticated` e `service_role`.
- [ ] Confirmar que o frontend não utiliza `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Confirmar que APIs não expõem `account_id`, `tenant_id` ou `owner_user_id` indevidamente.
- [ ] Confirmar seed/demo desabilitado ou isolado em produção.
- [ ] Confirmar backup/rollback manual documentado antes do deploy.

## Evidências recomendadas

- Captura/registro das policies críticas ativas.
- Registro do responsável pela validação e data/hora.
- Commit/release associado à validação.

## Referências cruzadas

- Configuração de produção: [configuracao-producao.md](./configuracao-producao.md)
- Preparação de deploy: [preparacao-deploy-real.md](./preparacao-deploy-real.md)
- Checklist pré-deploy: [checklist-pre-deploy.md](./checklist-pre-deploy.md)
- Checklist pós-deploy: [checklist-pos-deploy.md](./checklist-pos-deploy.md)
- Inventário de variáveis de produção: [inventario-variaveis-producao.md](./inventario-variaveis-producao.md)
