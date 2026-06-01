# dominios-v2

## core-platform
- objetivo: Base técnica compartilhada
- responsabilidade: Infra comum, cliente Supabase, roteamento base, utilitarios
- arquivos candidatos do legado: 32
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 25.1
- reaproveitamento medio: 83
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: admin-app/public/js/core/api.js; admin-app/public/js/core/events.js; admin-app/public/js/core/router.js; admin-app/public/utils.js; admin-app/scripts/dev-server.ps1; admin-app/scripts/stop-dev-server.ps1; admin-app/server.js; admin-app/src/enriquecimento/coleta-textos-publicos-cliente.js

## autenticacao-contas
- objetivo: Acesso seguro e contas
- responsabilidade: Login, sessao, identidade e ciclo de conta
- arquivos candidatos do legado: 1
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 20
- reaproveitamento medio: 88
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: admin-app/public/js/modules/login.js

## usuarios-permissoes
- objetivo: Governanca de acesso
- responsabilidade: Perfis, papeis, permissoes e politicas
- arquivos candidatos do legado: 24
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 21.3
- reaproveitamento medio: 76.2
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: admin-app/atualiza.bat; admin-app/package.json; admin-app/public/admin.html; admin-app/public/app.js; admin-app/public/index.html; admin-app/public/js/components/language-switcher.js; admin-app/public/js/i18n/index.js; admin-app/public/js/i18n/pt-BR.js

## clientes-crm
- objetivo: Gestao central de clientes
- responsabilidade: Cadastro, perfil e relacionamento CRM
- arquivos candidatos do legado: 16
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 8.5
- reaproveitamento medio: 97.8
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: admin-app/public/js/modules/clientes.js; admin-app/scripts/saneia-receita-clientes.js; admin-app/src/clientes/enriquecimento/enriquecimento-cadastro-completo.js; admin-app/src/clientes/enriquecimento/enriquecimento-cnpj.js; admin-app/src/clientes/enriquecimento/enriquecimento-fachada.js; admin-app/src/clientes/enriquecimento/index.js; admin-app/src/clientes/enriquecimento/normalizadores.js; admin-app/src/clientes/enriquecimento/schema-clientes.js

## pedidos-comercial
- objetivo: Gestao de pedidos
- responsabilidade: Fluxo comercial de pedidos e status
- arquivos candidatos do legado: 3
- recomendacao predominante: apenas_consultar
- risco medio: 14
- reaproveitamento medio: 44
- decisao sugerida: apenas_consultar
- exemplos de arquivos: admin-app/public/app.js.bak_before_pedidos_fix; admin-app/public/js/modules/pedidos.js; site-institucional/gestao-de-pedidos-representante.html

## produtos-catalogo
- objetivo: Catalogo comercial
- responsabilidade: Produtos, atributos e organizacao de oferta
- arquivos candidatos do legado: 4
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 10
- reaproveitamento medio: 94
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: admin-app/public/js/modules/produtos.js; admin-app/src/followup/produtos-comercial-dictionary.js; admin-app/supabase/migrations/20260513_add_multiplo_venda_produtos.sql; admin-app/supabase/migrations/20260518_add_foto_url_produtos.sql

## whatsapp-ia
- objetivo: Canal conversacional
- responsabilidade: Integracao WhatsApp, filas e automacoes IA
- arquivos candidatos do legado: 10
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 54
- reaproveitamento medio: 72.7
- decisao sugerida: reaproveitar_com_revisao
- exemplos de arquivos: admin-app/public/js/modules/agente-whatsapp-ia.js; admin-app/public/js/modules/whatsapp-evolution.js; admin-app/src/followup/prompts/prompt-resposta-whatsapp.js; admin-app/src/followup/prompts/prompt-whatsapp-comercial.js; admin-app/src/followup/whatsapp-message-queue.js; admin-app/src/whatsapp/whatsapp-identificacao.js; admin-app/src/whatsapp/whatsapp-instancias.js; admin-app/src/whatsapp/whatsapp-modos.js

## followup-ia
- objetivo: Orquestracao de follow-up
- responsabilidade: Memoria comercial, lembretes e cadencias IA
- arquivos candidatos do legado: 23
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 49.8
- reaproveitamento medio: 76.3
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: admin-app/public/js/modules/followup-agent.js; admin-app/public/js/modules/followup-aprovacao.js; admin-app/public/js/modules/followup-cockpit.js; admin-app/public/js/modules/followup-dossie-helpers.js; admin-app/public/js/modules/followup-memoria-comercial.js; admin-app/public/js/modules/followup-timeline.js; admin-app/public/js/modules/followup-visao-executiva.js; admin-app/scripts/test-followup-ia-comercial.js

## pipeline-comercial
- objetivo: Pipeline de vendas
- responsabilidade: Etapas, oportunidades e progressao comercial
- arquivos candidatos do legado: 1
- recomendacao predominante: apenas_consultar
- risco medio: 62
- reaproveitamento medio: 37
- decisao sugerida: apenas_consultar
- exemplos de arquivos: admin-app/public/js/modules/pipeline.js

## inteligencia-externa
- objetivo: Enriquecimento externo
- responsabilidade: SERP, enriquecimento e dados externos
- arquivos candidatos do legado: 48
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 16.3
- reaproveitamento medio: 68.9
- decisao sugerida: reaproveitar_com_revisao
- exemplos de arquivos: admin-app/public/js/modules/followup-inteligencia-ia.js; admin-app/public/site.css; admin-app/src/clientes/enriquecimento/enriquecimento-google-maps.js; admin-app/src/clientes/enriquecimento-maps-cliente.js; admin-app/src/clientes/repositorios/cliente-enriquecimento-maps-repository.js; admin-app/src/enriquecimento/analise-concorrencia.js; admin-app/src/enriquecimento/descoberta-digital-cliente.js; admin-app/src/enriquecimento/enriquecimento-externo-cliente.js

## importacoes
- objetivo: Entrada de dados em lote
- responsabilidade: Importacao de CSV/XLSX e validacoes
- arquivos candidatos do legado: 17
- recomendacao predominante: apenas_consultar
- risco medio: 1.2
- reaproveitamento medio: 26.8
- decisao sugerida: apenas_consultar
- exemplos de arquivos: admin-app/.dockerignore; admin-app/.gitignore; admin-app/Dockerfile; admin-app/public/favicon-animated.svg; admin-app/public/js/modules/importacoes-clientes.js; admin-app/public/js/modules/importacoes-estoque.js; admin-app/public/js/modules/importacoes-itens.js; admin-app/public/js/modules/importacoes-pedidos.js

## dashboard-bi
- objetivo: Camada analitica
- responsabilidade: Metricas, indicadores e visualizacao executiva
- arquivos candidatos do legado: 3
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 10.7
- reaproveitamento medio: 90.3
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: admin-app/public/js/modules/dashboard-ai.js; admin-app/public/js/modules/dashboard-cards.js; admin-app/public/js/modules/dashboard-executive.js

## billing-assinaturas
- objetivo: Monetizacao
- responsabilidade: Planos, assinatura e cobranca
- arquivos candidatos do legado: 2
- recomendacao predominante: copiar_para_novo_modulo
- risco medio: 32
- reaproveitamento medio: 89
- decisao sugerida: copiar_para_novo_modulo
- exemplos de arquivos: asaas.json; asaas.txt

## configuracoes
- objetivo: Administracao operacional
- responsabilidade: Parametros, settings e ajustes de sistema
- arquivos candidatos do legado: 0
- recomendacao predominante: apenas_consultar
- risco medio: 0
- reaproveitamento medio: 0
- decisao sugerida: apenas_consultar
- exemplos de arquivos: nenhum mapeado

## integracoes
- objetivo: Conectividade externa
- responsabilidade: Webhooks e integracoes com servicos terceiros
- arquivos candidatos do legado: 0
- recomendacao predominante: apenas_consultar
- risco medio: 0
- reaproveitamento medio: 0
- decisao sugerida: apenas_consultar
- exemplos de arquivos: nenhum mapeado

## auditoria-logs
- objetivo: Rastreabilidade e conformidade
- responsabilidade: Logs, trilhas de auditoria e eventos
- arquivos candidatos do legado: 3
- recomendacao predominante: apenas_consultar
- risco medio: 0
- reaproveitamento medio: 0
- decisao sugerida: apenas_consultar
- exemplos de arquivos: admin-app/logs/server.err.log; admin-app/logs/server.out.log; admin-app/logs/server.pid
