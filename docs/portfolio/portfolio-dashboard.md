# Portfolio Dashboard

## Objetivo
Consolidar, em uma única visão executiva, o estado de múltiplas contas SaaS já disponíveis no modo `memory`, sem criar integração externa nova e sem alterar o legado.

## Endpoint
`GET /portfolio-dashboard`

## Resposta
O endpoint retorna:
- `summary`
- `accounts`
- `rankings`
- `alerts`

## Regras de cálculo
- Consolida contas disponíveis no `memory` por meio dos módulos existentes de customer success, retenção, implantação, executive dashboard e revenue intelligence.
- Usa fallback determinístico quando não há dados reais suficientes.
- Classifica contas em `healthy`, `attention`, `risk` e `critical`.
- Calcula totais, médias, rankings e alertas executivos de forma apenas leitura.

## Limitações atuais
- A base ainda é sintética em `memory`.
- Não há mutação nem integração externa adicional.
- A visão é executiva e não substitui telas operacionais por conta.

## Integração
- Backend: `apps/api/src/modules/portfolio-dashboard/`
- Frontend: `apps/web/src/modules/portfolio-dashboard/`

## Visão futura
- Conectar a fontes reais quando estiverem disponíveis.
- Refinar alertas por segmento e por ciclo de vida.
- Incluir drill-down por conta e por coorte.
