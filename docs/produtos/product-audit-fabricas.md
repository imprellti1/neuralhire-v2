# Auditoria de Produtos e Vínculo com Fábricas

Esta etapa audita os produtos já existentes, identifica inconsistências e permite correções controladas sem reimportação em massa.

## Objetivo

- Diagnosticar a base real de produtos.
- Identificar produtos sem fábrica vinculada.
- Vínculo controlado com fabricantes.
- Ajustes pontuais em campos permitidos.

## Issues detectadas

- `missing_fabricante`
- `missing_image`
- `missing_sku`
- `missing_name`
- `missing_category`
- `missing_price`
- `invalid_price`
- `duplicate_sku`
- `duplicate_name`
- `inactive_product`
- `zero_stock`
- `missing_variations`
- `variation_without_image`
- `variation_without_stock`

## Limites

- Não reimporta produtos.
- Não executa update massivo.
- Não permite delete.
- `accountId` nunca vem do payload.

## Próxima etapa

71C deve evoluir para edição operacional de produtos, imagens, categorias e variações com mais profundidade.
