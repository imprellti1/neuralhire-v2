# Editor Operacional de Produtos

## Objetivo

Permitir ajuste controlado de produtos já existentes, sem reimportação e sem atualização em massa.

## Campos editáveis

- Nome
- SKU
- Descrição
- Fabricante
- Categoria
- Subcategoria
- Família
- Coleção
- Preço
- Preço unitário
- Status
- Imagem principal
- Galeria por URL

## Vínculo com fábrica

O produto pode ser associado a um fabricante existente. Ao exibir o produto, a UI mostra um resumo da fábrica com:

- id
- nome
- logoUrl
- pedidoMinimo
- boletoMinimo
- comissaoPadraoPercentual
- prazoMaximoDias

## Imagens

Nesta etapa, a solução usa `imagemUrl` e `galeria` como array de URLs.

## Variações

Cada variação contém:

- sku
- cor
- tamanho
- estoque
- preco
- imagemUrl
- ativo

## Limitações atuais

- Sem upload binário
- Sem editor próprio de categorias
- Sem atualização em massa
- Sem reimportação de catálogo

## Próxima etapa

Produto 360° com imagens, variações, pedidos e inteligência comercial.
