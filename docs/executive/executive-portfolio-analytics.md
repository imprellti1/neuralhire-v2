# Executive Portfolio Analytics

## Objetivo

Consolidar sinais operacionais do portfolio em uma camada executiva única para apoiar gestão de SaaS, retenção e expansão.

## Endpoint

`GET /executive-portfolio-analytics`

## Estrutura de resposta

- `overview`: total de contas, saúde, receita, churn e médias globais.
- `growthDrivers`: contas com maior potencial de expansão.
- `churnRisks`: contas com maior risco de retenção.
- `segmentPerformance`: performance por segmento.
- `benchmarkAnalysis`: comparação de cada conta com a média global.
- `recommendedActions`: recomendações executivas por severidade.

## Regras analíticas

- Growth drivers prioriza Growth Score, MRR e Receita Prevista.
- Churn risks prioriza status, saúde e churn projetado.
- Segment performance usa segmento real quando disponível; caso contrário, aplica fallback determinístico entre `SMB`, `Mid Market` e `Enterprise`.
- Benchmark usa a média global de `healthScore` e `growthScore`.
- Recommended actions transforma sinais operacionais em ações executivas simples e acionáveis.

## Benchmark

O benchmark compara cada conta com a média global do portfolio e calcula a diferença direta entre o health score da conta e a média executiva.

## Growth Drivers

As contas líderes recebem uma justificativa amigável com foco em adoção, expansão e consistência operacional.

## Churn Risks

As contas críticas ou em risco recebem diagnóstico resumido para orientar retenção e intervenção do Customer Success.

## Roadmap futuro

- Benchmarking cruzado entre portfolios.
- Projeções por faixa de receita e segmento.
- Alertas executivos em tempo quase real.
- Recomendações priorizadas por impacto financeiro.
