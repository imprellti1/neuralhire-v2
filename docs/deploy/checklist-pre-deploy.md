# Checklist Pré-Deploy — NeuralHire v2

## Objetivo

Garantir que o deploy manual só seja iniciado quando critérios técnicos e operacionais mínimos estiverem atendidos.

## Checklist

- [ ] Confirmar branch atual e origem do commit a ser implantado.
- [ ] Confirmar `working tree` limpo no repositório local.
- [ ] Executar `npm.cmd run quality` e validar sucesso completo.
- [ ] Confirmar CI `Quality` verde no GitHub para o mesmo commit.
- [ ] Confirmar variáveis obrigatórias por ambiente (sem secrets no código).
- [ ] Confirmar configuração Supabase, RLS e isolamento multi-tenant.
- [ ] Confirmar ausência de campos sensíveis no frontend (tenant/owner/token).
- [ ] Confirmar que migrations (se existirem futuramente) foram revisadas e aprovadas.
- [ ] Confirmar plano de rollback manual documentado e testável.
- [ ] Registrar responsável, horário planejado e commit alvo.

## Referências cruzadas

- Configuração de produção: [configuracao-producao.md](./configuracao-producao.md)
- Inventário de variáveis de produção: [inventario-variaveis-producao.md](./inventario-variaveis-producao.md)
- Checklist Supabase production: [supabase-production-checklist.md](./supabase-production-checklist.md)
- Preparação de deploy: [preparacao-deploy-real.md](./preparacao-deploy-real.md)
- Variáveis de ambiente: [variaveis-ambiente.md](./variaveis-ambiente.md)
- Checklist pós-deploy: [checklist-pos-deploy.md](./checklist-pos-deploy.md)
