# Aprovação de Lotes Legacy Import

## Fluxo
- O lote é validado e normalizado antes da decisão operacional.
- Manager, admin e super_admin podem aprovar ou rejeitar.
- A aprovação apenas altera o status do lote e dos records; não promove dados para tabelas oficiais.

## Rejeição
- A rejeição exige um motivo textual.
- O batch é marcado como `rejected` e os records relacionados seguem o mesmo status.

## Bloqueios
- Lotes com issue `severity=error` não podem ser aprovados.
- A API retorna `BATCH_HAS_ERRORS` quando o bloqueio é acionado.

## Responsabilidades
- Operação revisa issues, records e resumo executivo.
- Desenvolvimento de negócio acompanha o lote, mas a promoção real fica para a ETAPA 70B.

## Preparação para 70B
- Esta etapa guarda apenas auditoria e decisão operacional.
- A próxima etapa fará a promoção staging -> tabelas oficiais v2.
