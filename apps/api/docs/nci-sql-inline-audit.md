# NCI SQL Inline Audit

Data da auditoria: 2026-07-02

Escopo:
- `apps/api/src/`
- Runtime backend apenas para a migração
- `tests`, `migrations` e `scripts` aparecem separados como fora do escopo de runtime

Critérios usados:
- SQL inline explícito com `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WITH`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`, `ORDER BY`
- chamadas diretas ao banco fora de `DatabaseAdapter` / `BaseRepository`
- uso de `supabase.from(...).select/insert/update/delete/...` em runtime

## Resumo executivo

- Ocorrências totais identificadas no runtime revisado: 96
- Arquivos já alinhados com a infraestrutura NCI: 11
- Arquivos de runtime ainda com acesso direto ao banco ou SQL inline fora do catálogo: 15
- Arquivos fora de escopo de runtime revisados e separados: testes, migrations e scripts

## Já Usa NCI

Esses arquivos já passam pela infraestrutura NCI ou pelo Query Catalog.

| Domínio / módulo | Arquivo | Tipo de SQL / acesso | Ocorrências | Risco | Recomendação |
|---|---|---:|---:|---|---|
| customer-memory | `apps/api/src/modules/customer-memory/customer-memory.repository.js` | `BaseRepository` + `CustomerMemoryQueries` | 3 | baixo | já usa infraestrutura NCI |
| audit-logs | `apps/api/src/modules/audit-logs/audit-logs.repository.js` | `DatabaseAdapter` + `AuditLogsQueries` | 2 | baixo | já usa infraestrutura NCI |
| analytics | `apps/api/src/modules/analytics/analytics.repository.js` | `BaseRepository` + `AnalyticsQueries` | 4 | baixo | já usa infraestrutura NCI |
| clientes | `apps/api/src/modules/clientes/clientes.read.repository.js` | `BaseRepository` + `ClientesReadQueries` | 1 | baixo | já usa infraestrutura NCI |
| clientes | `apps/api/src/modules/clientes/clientes.search.repository.js` | `BaseRepository` + `ClientesSearchQueries` | 2 | baixo | já usa infraestrutura NCI |
| clientes | `apps/api/src/modules/clientes/clientes.write.repository.js` | `BaseRepository` + `ClientesWriteQueries` | 2 | baixo | já usa infraestrutura NCI |
| clientes | `apps/api/src/modules/clientes/clientes.metrics.repository.js` | `BaseRepository` + `ClientesMetricsQueries` | 2 | baixo | já usa infraestrutura NCI |
| queries | `apps/api/src/database/queries/ia-memorias.queries.js` | Query Catalog | 6 | baixo | já usa infraestrutura NCI |
| queries | `apps/api/src/database/queries/customer-memory.queries.js` | Query Catalog | 6 | baixo | já usa infraestrutura NCI |
| queries | `apps/api/src/database/queries/clientes-*.queries.js` | Query Catalog | 22 | baixo | já usa infraestrutura NCI |
| queries | `apps/api/src/database/queries/audit-logs.queries.js` | Query Catalog | 4 | baixo | já usa infraestrutura NCI |
| queries | `apps/api/src/database/queries/analytics.queries.js` | Query Catalog | 12 | baixo | já usa infraestrutura NCI |

## Runtime Ainda Inline

### Alto risco

| Domínio / módulo | Arquivo | Tipo de SQL / acesso | Ocorrências | Risco | Recomendação |
|---|---|---:|---:|---|---|
| jobs | `apps/api/src/modules/jobs/jobs.repository.js` | `supabase.from(...).select/insert/update/delete` em múltiplas rotas de agendamento | 14 | alto | migrar para Query Catalog |
| ai-director | `apps/api/src/modules/ai-director-observations/ai-director-observations.repository.js` | acesso direto ao Supabase em CRUD e limpeza de duplicados | 9 | alto | migrar para Query Catalog |
| ai-director | `apps/api/src/modules/ai-director/ai-director.repository.js` | acesso direto ao Supabase em memórias e memórias executivas | 7 | alto | migrar para Query Catalog |
| legacy-import | `apps/api/src/modules/legacy-import/legacy-import-staging.repository.js` | CRUD direto em batches, records e issues | 11 | alto | migrar para Query Catalog |
| fabricantes | `apps/api/src/modules/fabricantes/fabricantes.repository.js` | CRUD direto em `fabricantes` e vínculos com vendedores | 13 | alto | migrar para Query Catalog |
| vendedores | `apps/api/src/modules/vendedores/vendedores.repository.js` | CRUD direto em `vendedores` e `vendedor_fabricantes` | 10 | alto | migrar para Query Catalog |
| interest-leads | `apps/api/src/modules/interest-leads/interest-leads.repository.js` | CRUD direto em leads e eventos | 6 | alto | migrar para Query Catalog |
| grupos-comerciais | `apps/api/src/modules/grupos-comerciais/grupos-comerciais.repository.js` | CRUD direto e join relacional via Supabase | 8 | alto | migrar para Query Catalog |

### Médio risco

| Domínio / módulo | Arquivo | Tipo de SQL / acesso | Ocorrências | Risco | Recomendação |
|---|---|---:|---:|---|---|
| aprovação-inteligência | `apps/api/src/modules/approval-intelligence/approval-intelligence.repository.js` | múltiplos `supabase.from(...).select(...)` para composição de dashboard | 4 | médio | migrar para Query Catalog |
| clientes | `apps/api/src/modules/clientes/clientes.repository.legacy.js` | legado com acesso direto ao Supabase / fallback antigo | 8 | médio | manter temporariamente |
| produtos | `apps/api/src/modules/produtos/produtos.repository.js` | CRUD direto no Supabase, incluindo imagens e variações | 14 | médio | migrar para Query Catalog |
| produto-audit | `apps/api/src/modules/product-audit/product-audit.repository.js` | listagens diretas com paginação e joins implícitos | 2 | médio | migrar para Query Catalog |
| whatsapp-learning | `apps/api/src/modules/whatsapp-learning/whatsapp-learning.repository.js` | persistência direta de eventos e conhecimento | 5 | médio | migrar para Query Catalog |
| whatsapp-learning | `apps/api/src/modules/whatsapp-learning/customer-knowledge.repository.js` | persistência direta de conhecimento do cliente | 4 | médio | migrar para Query Catalog |
| whatsapp-learning | `apps/api/src/modules/whatsapp-learning/customer-knowledge-embedding.repository.js` | persistência direta de embeddings | 4 | médio | manter temporariamente |
| whatsapp-conversations | `apps/api/src/modules/whatsapp-conversations/whatsapp-conversations.repository.js` | CRUD direto em conversas, mensagens e eventos | 7 | médio | migrar para Query Catalog |
| message-drafts | `apps/api/src/modules/message-drafts/message-drafts.repository.js` | banco/estado híbrido com acesso direto indireto | 3 | médio | manter temporariamente |
| message-approvals | `apps/api/src/modules/message-approvals/message-approvals.repository.js` | depende de drafts e conversas, sem SQL explícito aqui | 1 | médio | falso positivo |
| billing | `apps/api/src/modules/billing/billing.repository.js` | estado em memória, sem SQL real | 0 | baixo | falso positivo |
| customer-success-automation | `apps/api/src/modules/customer-success-automation/customer-success-automation.repository.js` | agregação de domínio sem SQL explícito | 0 | baixo | falso positivo |

### Baixo risco

| Domínio / módulo | Arquivo | Tipo de SQL / acesso | Ocorrências | Risco | Recomendação |
|---|---|---:|---:|---|---|
| ai-sales | `apps/api/src/modules/ai-sales/ai-sales.repository.js` | compõe dados a partir de outros repositórios | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| executive-dashboard | `apps/api/src/modules/executive-dashboard/executive-dashboard.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| executive-portfolio-analytics | `apps/api/src/modules/executive-portfolio-analytics/executive-portfolio-analytics.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| portfolio-dashboard | `apps/api/src/modules/portfolio-dashboard/portfolio-dashboard.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| revenue-intelligence | `apps/api/src/modules/revenue-intelligence/revenue-intelligence.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| account-activation | `apps/api/src/modules/account-activation/account-activation.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| customer-success | `apps/api/src/modules/customer-success/customer-success.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| customer-retention | `apps/api/src/modules/customer-retention/customer-retention.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| implementation-tracker | `apps/api/src/modules/implementation-tracker/implementation-tracker.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |
| onboarding | `apps/api/src/modules/onboarding/onboarding.repository.js` | composição de domínio | 0 | baixo | já usa infraestrutura NCI / sem SQL inline relevante |

## Fora do Escopo de Runtime

Esses itens foram vistos na varredura, mas ficam fora da migração de runtime desta fase:

- `apps/api/src/testing/tests/*.test.js`
- `apps/api/src/modules/**.test.js`
- `apps/api/src/database/*.test.js`
- migrations em `supabase/migrations/` e `packages/database/supabase/migrations/`
- scripts ou seeders em `apps/api/src/testing/*`

### Observações sobre testes

- Há muito SQL fake/mocked em testes de `database`, `clientes`, `jobs`, `audit-logs` e `analytics`.
- Isso é útil como contrato, mas não deve ser tratado como dívida de runtime nesta fase.
- A auditoria não propõe alteração em testes, conforme restrição da fase.

### Observações sobre migrations/scripts

- SQL em migrations/scripts deve ser documentado, mas não conta como inline remanescente de runtime.
- Se houver alinhamento posterior, a migração deve ser separada por fase e por árvore de migrations.

## Principais Domínios Com SQL Inline

1. `jobs`
2. `ai-director`
3. `fabricantes`
4. `vendedores`
5. `legacy-import`
6. `produtos`
7. `whatsapp-learning`
8. `whatsapp-conversations`
9. `interest-leads`
10. `grupos-comerciais`

## Próximos Candidatos Recomendados

Prioridade 1:
- `apps/api/src/modules/jobs/jobs.repository.js`
- `apps/api/src/modules/ai-director-observations/ai-director-observations.repository.js`
- `apps/api/src/modules/ai-director/ai-director.repository.js`

Prioridade 2:
- `apps/api/src/modules/legacy-import/legacy-import-staging.repository.js`
- `apps/api/src/modules/fabricantes/fabricantes.repository.js`
- `apps/api/src/modules/vendedores/vendedores.repository.js`
- `apps/api/src/modules/interest-leads/interest-leads.repository.js`

Prioridade 3:
- `apps/api/src/modules/grupos-comerciais/grupos-comerciais.repository.js`
- `apps/api/src/modules/produtos/produtos.repository.js`
- `apps/api/src/modules/whatsapp-conversations/whatsapp-conversations.repository.js`
- `apps/api/src/modules/whatsapp-learning/whatsapp-learning.repository.js`

## Leitura de Risco

- `alto`: CRUD direto em múltiplas entidades ou rotinas de jobs com impacto operacional.
- `médio`: módulos ainda fora do catálogo, mas com superfície menor ou mais previsível.
- `baixo`: já está no Query Catalog ou é falso positivo / composição sem SQL inline relevante.

