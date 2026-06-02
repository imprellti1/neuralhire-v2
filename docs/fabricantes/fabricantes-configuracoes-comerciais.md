# Fábricas e Configurações Comerciais

## Objetivo

Centralizar o cadastro de fabricantes e suas regras comerciais antes da evolução do catálogo de produtos e da digitação de pedidos.

## Campos da fábrica

- `nome`
- `razao_social`
- `cnpj`
- `logo_url`
- `status`
- `pedido_minimo`
- `boleto_minimo`
- `comissao_padrao_percentual`
- `prazo_maximo_dias`
- `observacoes`

## Regras comerciais

- `pedido_minimo` e `boleto_minimo` ficam disponíveis para validações futuras.
- `comissao_padrao_percentual` prepara o cálculo comercial de comissão.
- `prazo_maximo_dias` prepara a regra de prazo máximo de pagamento.

## Condições de pagamento

Cada fabricante pode ter várias condições cadastradas em `fabricante_condicoes_pagamento`, com:

- nome
- código
- parcelas
- prazo médio em dias
- valor mínimo
- acréscimo percentual
- ativo/inativo

## Uso futuro

- Produtos serão vinculados a uma fábrica.
- Pedidos poderão herdar validações de pedido mínimo e boleto mínimo.
- Prazos, comissão e agente comercial poderão consultar a configuração do fabricante.

## Limitação atual do `logo_url`

- Nesta etapa o logo é apenas referência por URL.
- Upload binário e storage dedicado ficam para uma etapa posterior.
