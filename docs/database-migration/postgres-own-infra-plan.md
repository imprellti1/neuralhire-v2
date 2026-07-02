# Plano Técnico de Migração: Supabase -> PostgreSQL Próprio

## Objetivo

Preparar o NeuralHire v2 para uma migração gradual de Supabase para PostgreSQL próprio, sem alterar comportamento, sem trocar repositories, sem remover Supabase e sem mudar o runtime principal nesta fase.

## Arquitetura atual

- API e frontend dependem de Supabase como backend de dados.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` continuam sendo variáveis centrais.
- Os repositories existentes seguem usando o contrato atual de acesso a dados.
- A validação de dados, autenticação e roteamento permanecem acoplados ao modelo atual.

## Arquitetura alvo

- PostgreSQL próprio passa a ser a base transacional principal.
- Supabase deixa de ser dependência de persistência principal, mas permanece disponível durante a transição.
- O acesso ao banco futuro deverá ser introduzido por etapas, com compatibilidade controlada entre os dois ambientes.
- A migração deve preservar o comportamento observável em cada módulo até o corte final.

## Dependências Supabase atuais

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- Repositories e fluxos já implementados sobre o contrato atual.
- Migrations e schema history existentes no ecossistema Supabase.

## Riscos principais

- Divergência de schema entre o modelo atual e o PostgreSQL próprio.
- Quebra de contratos implícitos em repositories, testes e seeds.
- Perda de compatibilidade durante a transição se o corte for feito cedo demais.
- Risco operacional ao misturar leitura/escrita em dois backends sem observabilidade clara.
- Configuração de conexão incorreta, SSL, credenciais ou roteamento em produção.

## Fases da migração

### Fase 0

- Documentar o plano.
- Adicionar exemplo de ambiente para PostgreSQL próprio.
- Criar smoke test isolado de conexão.
- Manter Supabase como fonte ativa.

### Fase 1

- Introduzir camada de acesso compatível com PostgreSQL próprio, sem desativar Supabase.
- Validar leitura pontual e contratos de conexão.

### Fase 2

- Migrar módulo a módulo com cobertura de testes e rollback explícito.
- Manter sincronização contratual entre schema, repositories e fixtures.

### Fase 3

- Consolidar o corte final.
- Remover dependência funcional de Supabase apenas após validação completa.

## Estratégia de rollback

- Manter Supabase intacto enquanto a migração não estiver finalizada.
- Toda mudança futura deve preservar um caminho de retorno para o backend atual.
- O rollback deve consistir em reverter a variável de provider e o caminho de execução para o contrato Supabase vigente.
- Nenhum corte definitivo deve acontecer sem validação operacional e funcional equivalente.

## Checklist de produção

- [ ] Confirmar `DATABASE_URL` válido para o ambiente alvo.
- [ ] Confirmar que o smoke test conecta e executa `select current_database(), current_user, now();`.
- [ ] Confirmar que `SUPABASE_URL` continua configurado.
- [ ] Confirmar que `SUPABASE_SERVICE_ROLE_KEY` continua configurado.
- [ ] Confirmar que `SUPABASE_ANON_KEY` continua configurado.
- [ ] Confirmar que a API segue operando sem mudanças de runtime nesta fase.
- [ ] Confirmar observabilidade mínima para falhas de conexão e credenciais.
- [ ] Confirmar plano de rollback operacional antes de qualquer corte.

## Ordem recomendada de migração por módulo

1. Infraestrutura de conexão e verificação.
2. Módulos de menor risco e maior isolamento.
3. Módulos com leitura intensa e escrita controlada.
4. Módulos com contratos mais críticos de multi-tenant e autenticação.
5. Módulos transacionais centrais apenas após os demais estabilizarem.

## Observações

- Esta fase não substitui repositories.
- Esta fase não altera rotas.
- Esta fase não altera autenticação.
- Esta fase não remove variáveis Supabase.
- Esta fase apenas prepara a migração com documentação e verificação isolada.
