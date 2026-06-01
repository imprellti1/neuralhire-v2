# resumo-executivo

- Total de arquivos analisados: 187
- Total de rotas detectadas: 0
- Total de console.log: 991
- Total de setInterval/cron: 26

## Totais por extensao

- (sem_ext): 6
- .bak_before_pedidos_fix: 1
- .bat: 3
- .css: 10
- .html: 21
- .ico: 2
- .jpg: 1
- .js: 89
- .json: 7
- .log: 2
- .pid: 1
- .ps1: 2
- .sql: 28
- .svg: 11
- .txt: 1
- .zip: 2

## Totais por risco

- baixo: 175
- medio: 9
- alto: 3
- critico: 0

## Top 10 arquivos mais criticos

1. admin-app/public/js/modules/followup-agent.js (medio | op:62 comp:100)
2. admin-app/server.js (alto | op:62 comp:100)
3. admin-app/_archive_cleanup/app-duplicado/app/server.js (alto | op:62 comp:100)
4. admin-app/_archive_cleanup/app-duplicado/server.js (alto | op:62 comp:100)
5. admin-app/public/app.js (medio | op:42 comp:100)
6. admin-app/_archive_cleanup/app-duplicado/app/public/app.js (medio | op:42 comp:100)
7. admin-app/_archive_cleanup/app-duplicado/public/app.js (medio | op:42 comp:100)
8. admin-app/src/enriquecimento/descoberta-digital-cliente.js (medio | op:32 comp:87)
9. admin-app/public/js/modules/pedidos.js (medio | op:42 comp:73)
10. admin-app/public/js/modules/pipeline.js (medio | op:62 comp:46)

## Top 10 candidatos a reaproveitamento

1. admin-app/atualiza.bat (reap:100 | copiar_para_novo_modulo)
2. admin-app/package.json (reap:100 | copiar_para_novo_modulo)
3. admin-app/public/js/core/api.js (reap:100 | copiar_para_novo_modulo)
4. admin-app/public/js/core/events.js (reap:100 | copiar_para_novo_modulo)
5. admin-app/public/js/modules/importacoes-clientes.js (reap:100 | copiar_para_novo_modulo)
6. admin-app/scripts/dev-server.ps1 (reap:100 | copiar_para_novo_modulo)
7. admin-app/scripts/stop-dev-server.ps1 (reap:100 | copiar_para_novo_modulo)
8. admin-app/src/clientes/enriquecimento/enriquecimento-cadastro-completo.js (reap:100 | copiar_para_novo_modulo)
9. admin-app/src/clientes/enriquecimento/enriquecimento-cnpj.js (reap:100 | copiar_para_novo_modulo)
10. admin-app/src/clientes/enriquecimento/enriquecimento-fachada.js (reap:100 | copiar_para_novo_modulo)

## Top 10 para reescrever do zero

Nenhum arquivo marcado com reescrever_do_zero

## Recomendacoes objetivas NEURAL HIRE

- Priorizar reescrita dos itens criticos com rotas/jobs em modulos isolados.
- Reaproveitar apenas candidatos com score alto e baixo acoplamento.
- Evitar copiar server.js e schedulers; migrar apenas regras de negocio validadas.
- Implantar testes de equivalencia para rotas e fluxos pipeline/followup antes de ativacao gradual.