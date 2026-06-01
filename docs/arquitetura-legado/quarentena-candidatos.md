# quarentena-candidatos

Quarentena aqui significa apenas classificacao documental.

| Arquivo | Risco | Motivo | Dependencias | Acao recomendada |
|---|---|---|---|---|
| admin-app/atualiza.bat | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/package.json | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/public/admin.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/app.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | ./utils.js, ./js/modules/followup-agent.js, ./js/modules/login.js, ./js/modules/clientes.js, ./js/modules/pedidos.js | apenas_consultar |
| admin-app/public/index.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/core/api.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/core/events.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/core/router.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/i18n/index.js | BAIXO | analise_preventiva | ./pt-BR.js | nao_usar |
| admin-app/public/js/i18n/pt-BR.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/modules/agente-whatsapp-ia.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | - | apenas_consultar |
| admin-app/public/js/modules/clientes.js | ALTO | complexidade_alta_ou_arquivo_critico | ../../utils.js, ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/dashboard-ai.js | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/public/js/modules/dashboard-cards.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/followup-agent.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | ./followup-cockpit.js, ./followup-timeline.js, ./followup-aprovacao.js, ./followup-inteligencia-ia.js, ./followup-memoria-comercial.js | apenas_consultar |
| admin-app/public/js/modules/followup-aprovacao.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/followup-cockpit.js | ALTO | complexidade_alta_ou_arquivo_critico | ./followup-dossie-helpers.js, ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/followup-dossie-helpers.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/followup-inteligencia-ia.js | ALTO | complexidade_alta_ou_arquivo_critico | ./followup-dossie-helpers.js, ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/followup-memoria-comercial.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/modules/followup-timeline.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/followup-visao-executiva.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/importacoes-clientes.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/modules/importacoes-estoque.js | BAIXO | analise_preventiva | ../i18n/index.js | nao_usar |
| admin-app/public/js/modules/importacoes-itens.js | BAIXO | analise_preventiva | ../i18n/index.js | nao_usar |
| admin-app/public/js/modules/importacoes-pedidos.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/importacoes-produtos.js | BAIXO | analise_preventiva | ../i18n/index.js | nao_usar |
| admin-app/public/js/modules/mapa.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/modules/pedidos.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/js/modules/pipeline.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | ../i18n/index.js | apenas_consultar |
| admin-app/public/js/modules/sinais-comerciais.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/js/modules/whatsapp-evolution.js | ALTO | complexidade_alta_ou_arquivo_critico | ../i18n/index.js | reescrever_do_zero |
| admin-app/public/styles.css | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/public/utils.js | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/scripts/dev-server.ps1 | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/scripts/saneia-receita-clientes.js | ALTO | complexidade_alta_ou_arquivo_critico | dotenv, node:url | reescrever_do_zero |
| admin-app/scripts/stop-dev-server.ps1 | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/scripts/test-followup-ia-comercial.js | ALTO | complexidade_alta_ou_arquivo_critico | ../src/followup/estado-estrategico, ../src/followup/validacao-coerencia-comercial | reescrever_do_zero |
| admin-app/server.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | dotenv, node:http, node:fs, node:path, node:crypto | apenas_consultar |
| admin-app/src/clientes/enriquecimento/enriquecimento-cadastro-completo.js | ALTO | complexidade_alta_ou_arquivo_critico | ./enriquecimento-cnpj, ./enriquecimento-google-maps, ./enriquecimento-fachada, ./schema-clientes | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento/enriquecimento-cnpj.js | ALTO | complexidade_alta_ou_arquivo_critico | ./normalizadores | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento/enriquecimento-fachada.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento/enriquecimento-google-maps.js | ALTO | complexidade_alta_ou_arquivo_critico | ./normalizadores | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento/index.js | ALTO | complexidade_alta_ou_arquivo_critico | ./enriquecimento-cnpj, ./enriquecimento-google-maps, ./enriquecimento-fachada, ./enriquecimento-cadastro-completo | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento/normalizadores.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento/schema-clientes.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento-cnpj-cliente.js | ALTO | complexidade_alta_ou_arquivo_critico | ./repositorios/cliente-enriquecimento-cnpj-repository | reescrever_do_zero |
| admin-app/src/clientes/enriquecimento-maps-cliente.js | ALTO | complexidade_alta_ou_arquivo_critico | ./repositorios/cliente-enriquecimento-maps-repository | reescrever_do_zero |
| admin-app/src/clientes/repositorios/cliente-enriquecimento-cnpj-repository.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/clientes/repositorios/cliente-enriquecimento-maps-repository.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/clientes/repositorios/cliente-metricas-comerciais-repository.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/clientes/repositorios/cliente-pipeline-ia-repository.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/enriquecimento/coleta-textos-publicos-cliente.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/enriquecimento/descoberta-digital-cliente.js | ALTO | complexidade_alta_ou_arquivo_critico | ../followup/ia-externa/classificador-perfil-loja, ../followup/ia-externa/detector-segmentos, ../followup/ia-externa/detector-presenca-digital, ../followup/ia-externa/higienizador-resultados-externos, ../followup/ia-externa/higienizador-semantico-externo | reescrever_do_zero |
| admin-app/src/enriquecimento/enriquecimento-externo-cliente.js | ALTO | complexidade_alta_ou_arquivo_critico | ./descoberta-digital-cliente, ./coleta-textos-publicos-cliente, ./analise-concorrencia, ../followup/ia-externa/analisador-concorrentes-multicanal | reescrever_do_zero |
| admin-app/src/followup/consolidacao-tags-comerciais.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/crm-pipeline-sync.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/datas-comerciais.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/estado-estrategico.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/estado-executivo-comercial.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-comercial.js | ALTO | complexidade_alta_ou_arquivo_critico | ./prompts/prompt-whatsapp-comercial, ./ia-snapshots, ./sinais-comerciais-engine, ./datas-comerciais, ./produtos-comercial-dictionary | reescrever_do_zero |
| admin-app/src/followup/ia-externa/analisador-concorrentes-multicanal.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-externa/classificador-perfil-loja.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-externa/detector-presenca-digital.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-externa/detector-segmentos.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-externa/higienizador-resultados-externos.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-externa/higienizador-semantico-externo.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-externa/motor-inteligencia-estrategica.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/ia-snapshots.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/produtos-comercial-dictionary.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/prompts/prompt-resposta-whatsapp.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/prompts/prompt-whatsapp-comercial.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/resposta-comercial-ia.js | ALTO | complexidade_alta_ou_arquivo_critico | ./prompts/prompt-resposta-whatsapp | reescrever_do_zero |
| admin-app/src/followup/sinais-comerciais-db.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/sinais-comerciais-engine.js | ALTO | complexidade_alta_ou_arquivo_critico | ./datas-comerciais | reescrever_do_zero |
| admin-app/src/followup/sinais-nao-classificados.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/followup/validacao-coerencia-comercial.js | ALTO | complexidade_alta_ou_arquivo_critico | ./ia-comercial | reescrever_do_zero |
| admin-app/src/followup/whatsapp-message-queue.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | - | apenas_consultar |
| admin-app/src/whatsapp/identificacao-cliente-whatsapp.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/whatsapp/whatsapp-identificacao.js | ALTO | complexidade_alta_ou_arquivo_critico | ./whatsapp-modos | reescrever_do_zero |
| admin-app/src/whatsapp/whatsapp-instancias.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/src/whatsapp/whatsapp-modos.js | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260512_add_created_by_user_id_condicoes_pagamento.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260513_add_multiplo_venda_produtos.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260513_create_fabricante_regras.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260514_add_codigo_cliente_fabricante_clientes.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260515_add_logo_url_fabricantes.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260515_create_client_cnpj_job_logs.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260518_add_foto_url_produtos.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260518_agente_followup_fase1.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260520_add_bloqueio_followup_manual_clientes.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260520_add_vendedor_id_app_users.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260520_create_cliente_dossies_ia.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260520_create_cliente_memoria_comercial.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260521_resumo_comercial_oficial.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260526_add_ai_pipeline_fields_to_clientes.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260526_create_cliente_whatsapp_message_queue.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260527_add_whatsapp_contact_fields_clientes.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260527_upgrade_sinais_comerciais_pendentes_operacional.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/supabase/migrations/20260527_whatsapp_queue_metrics_and_runtime_fields.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260528_add_cliente_cadastro_enriquecido_fields.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260528_cliente_descoberta_digital_unique_account_cliente.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/20260528_refactor_clientes_enriquecimento.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/migrations/create-sinais-comerciais-pendentes.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/sql/clientes_resumo_comercial_view.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/sql/ia_comercial_snapshots.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/sql/sinais_comerciais.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/supabase/sql/sinais_comerciais_regex.sql | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/_archive_cleanup/app-duplicado/app/package.json | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/_archive_cleanup/app-duplicado/app/public/admin.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/_archive_cleanup/app-duplicado/app/public/app.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | - | apenas_consultar |
| admin-app/_archive_cleanup/app-duplicado/app/public/index.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/_archive_cleanup/app-duplicado/app/public/styles.css | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/_archive_cleanup/app-duplicado/app/server.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | node:http, node:fs, node:path, node:crypto, node:url | apenas_consultar |
| admin-app/_archive_cleanup/app-duplicado/atualiza.bat | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/_archive_cleanup/app-duplicado/package.json | BAIXO | analise_preventiva | - | nao_usar |
| admin-app/_archive_cleanup/app-duplicado/public/admin.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/_archive_cleanup/app-duplicado/public/app.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | - | apenas_consultar |
| admin-app/_archive_cleanup/app-duplicado/public/index.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/_archive_cleanup/app-duplicado/public/styles.css | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| admin-app/_archive_cleanup/app-duplicado/server.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | node:http, node:fs, node:path, node:crypto, node:url | apenas_consultar |
| asaas.json | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| asaas.txt | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| Representantes - Fluxo Consolidado V7.4 (Restaura Apos Supabase) (1).json | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/50x.html | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/atendimento-comercial-representantes.html | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/atualiza.bat | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/automacao-comercial-representantes.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/crm-para-representante-comercial.html | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/follow-up-automatico-clientes.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/funcionalidades.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/gestao-de-carteira-de-clientes.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/gestao-de-pedidos-representante.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/html/50x.html | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/html/index.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/html/institucional.css | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/html/package.json | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/html/server.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | node:http, node:fs, node:path, resend | apenas_consultar |
| site-institucional/index.backup.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/index.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/institucional.css | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/institucional.html | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/landing_leads.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |
| site-institucional/package.json | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/plans.js | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/server.js | ALTO | complexidade_alta_ou_arquivo_critico, componente_critico_em_execucao | node:http, node:fs, node:path | apenas_consultar |
| site-institucional/sistema-b2b-para-representantes.html | BAIXO | analise_preventiva | - | nao_usar |
| site-institucional/sistema-para-representante-comercial.html | BAIXO | analise_preventiva | - | nao_usar |
| supabase/seeds/sinais-comerciais-crm-ia.sql | ALTO | complexidade_alta_ou_arquivo_critico | - | reescrever_do_zero |