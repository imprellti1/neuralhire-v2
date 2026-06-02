# ETAPA 66 - Retention & Expansion

## Endpoint
- `GET /accounts/:accountId/customer-retention`
- Retorno: `renovacao`, `expansaoScore`, `churnPreventivo`, `acoes`.
- Modo suportado: memory e supabase (somente analise/recomendacao).

## Renovacao
- Classifica por `diasRestantes`: 30, 15, 7 e vencida.
- Classificacoes: `saudavel`, `atencao`, `critica`, `vencida`.

## Score de Expansao
- Base: uso crescente, usuarios ativos, adocao alta, health score alto e churn baixo.
- Faixas: 0-25 Baixo, 26-50 Moderado, 51-75 Alto, 76-100 Excelente.

## Churn Preventivo
- Base: health score, churn risk, automacoes CS, timeline e engajamento.
- Faixas: Baixo, Medio, Alto, Critico.

## Acoes Automaticas
- Tipos recomendados: renovacao, expansao, upgrade, adocao, churn, uso.
- Apenas recomendacao; sem cobranca real, upgrade real, e-mail, WhatsApp ou integracao externa.
