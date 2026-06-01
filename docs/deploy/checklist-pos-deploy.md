# Checklist Pós-Deploy — NeuralHire v2

## Objetivo

Validar rapidamente a saúde funcional e de segurança após deploy manual em ambiente real.

## Checklist funcional e técnico

- [ ] Validar login/autenticação.
- [ ] Validar isolamento básico de tenant (multi-tenant).
- [ ] Validar ownership por vendedor.

### Clientes

- [ ] Listagem.
- [ ] Detalhe.
- [ ] Criação.

### Produtos

- [ ] Listagem.
- [ ] Criação.
- [ ] Produto 360°.
- [ ] Edição.
- [ ] CSV.

### Pedidos

- [ ] Listagem.
- [ ] Detalhe.
- [ ] Ações de status.

### Analytics/Dashboards

- [ ] Validar indicadores e respostas principais.

### Observabilidade

- [ ] Validar logs da aplicação e da plataforma.
- [ ] Confirmar ausência de erros 401/403/500 inesperados.

## Registro operacional

- [ ] Registrar versão e commit implantado.
- [ ] Registrar horário do deploy e responsável.
- [ ] Registrar incidentes encontrados e ação tomada.

## Referências cruzadas

- Configuração de produção: [configuracao-producao.md](./configuracao-producao.md)
- Checklist Supabase production: [supabase-production-checklist.md](./supabase-production-checklist.md)
- Inventário de variáveis de produção: [inventario-variaveis-producao.md](./inventario-variaveis-producao.md)
- Preparação de deploy: [preparacao-deploy-real.md](./preparacao-deploy-real.md)
- Checklist pré-deploy: [checklist-pre-deploy.md](./checklist-pre-deploy.md)
- Variáveis de ambiente: [variaveis-ambiente.md](./variaveis-ambiente.md)
