# resumo-executivo-reconstrucao

- total de arquivos mapeados: 187
- total sem dominio: 0
- cobertura percentual: 100%
- dominios encontrados: 14
- Cobertura acima de 70%. Mapeamento apto para priorizacao inicial de backlog por dominio.

## Top 10 dominios mais arriscados

1. pipeline-comercial (risco medio 62, arquivos 1)
2. whatsapp-ia (risco medio 54, arquivos 10)
3. followup-ia (risco medio 49.8, arquivos 23)
4. billing-assinaturas (risco medio 32, arquivos 2)
5. core-platform (risco medio 25.1, arquivos 32)
6. usuarios-permissoes (risco medio 21.3, arquivos 24)
7. autenticacao-contas (risco medio 20, arquivos 1)
8. inteligencia-externa (risco medio 16.3, arquivos 48)
9. pedidos-comercial (risco medio 14, arquivos 3)
10. dashboard-bi (risco medio 10.7, arquivos 3)

## Top 10 dominios com maior reaproveitamento

1. clientes-crm (reaproveitamento medio 97.8, arquivos 16)
2. produtos-catalogo (reaproveitamento medio 94, arquivos 4)
3. dashboard-bi (reaproveitamento medio 90.3, arquivos 3)
4. billing-assinaturas (reaproveitamento medio 89, arquivos 2)
5. autenticacao-contas (reaproveitamento medio 88, arquivos 1)
6. core-platform (reaproveitamento medio 83, arquivos 32)
7. followup-ia (reaproveitamento medio 76.3, arquivos 23)
8. usuarios-permissoes (reaproveitamento medio 76.2, arquivos 24)
9. whatsapp-ia (reaproveitamento medio 72.7, arquivos 10)
10. inteligencia-externa (reaproveitamento medio 68.9, arquivos 48)

## Recomendacao final objetiva

- Implementar primeiro fundacao + dominios transversais (core/auth/permissoes).
- Tratar dominios com maior risco operacional por contratos e testes de equivalencia.
- Reaproveitar apenas blocos com baixo acoplamento e alto reaproveitamento.