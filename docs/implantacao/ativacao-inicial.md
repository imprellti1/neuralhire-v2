# Ativacao Inicial

Fluxo: onboarding concluido direciona para `#/activation`, onde o assinante acompanha as 6 etapas da implantacao.

Criterios de conclusao: empresa configurada, vendedores cadastrados, clientes importados, produtos importados, pedidos importados, dashboard disponivel.

Calculo percentual: `(etapas concluidas / 6) * 100`, arredondado.

Dependencias: dados de `GET /clientes`, `GET /produtos`, `GET /pedidos` e estado de onboarding da conta.

Integracao onboarding -> ativacao: ao concluir onboarding, a tela de ativacao passa a refletir automaticamente o progresso operacional.
