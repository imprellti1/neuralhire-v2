# plano-geral

## Visao geral da reconstrucao
Reconstrucao do NeuralHire v2 orientada por dominios, usando o legado apenas como referencia analitica para reduzir risco e aumentar previsibilidade.

## Premissas
- Legado em modo somente leitura.
- Sem copia cega de codigo.
- Decisoes guiadas por score (complexidade, acoplamento, risco operacional, reaproveitamento).
- Entregas incrementais por fase e dominio.

## Regra critica
Legado somente leitura: nenhum arquivo do Projeto Representantes deve ser alterado, movido ou removido.

## Estrategia de migracao gradual
1. Estabelecer fundacao tecnica e contratos.
2. Migrar dominios core e dados essenciais.
3. Adicionar IA comercial como dominio independente.
4. Consolidar BI, billing e governanca.
5. Escalar com multi-tenant e integracoes avancadas.

## Ordem recomendada de construcao
1. whatsapp-ia
2. followup-ia
3. inteligencia-externa
4. pipeline-comercial
5. clientes-crm
6. pedidos-comercial
7. produtos-catalogo
8. importacoes
9. billing-assinaturas
10. dashboard-bi
11. autenticacao-contas
12. usuarios-permissoes
13. integracoes
14. auditoria-logs
15. configuracoes
16. core-platform

## Riscos principais
- Modulos com alto acoplamento e baixa separacao de responsabilidades.
- Jobs/filas/cron misturados com fluxo HTTP.
- Dependencias cruzadas entre dominios comerciais e canais.

## Dominios oficiais da v2
- core-platform
- autenticacao-contas
- usuarios-permissoes
- clientes-crm
- pedidos-comercial
- produtos-catalogo
- whatsapp-ia
- followup-ia
- pipeline-comercial
- inteligencia-externa
- importacoes
- dashboard-bi
- billing-assinaturas
- configuracoes
- integracoes
- auditoria-logs
