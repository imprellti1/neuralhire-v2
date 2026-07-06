import { PRODUTO_VARIACOES_SELECT_FIELDS } from './produto-variacoes.queries.js';

const PRODUTOS_IMPORT_SELECT_FIELDS = 'id, account_id, fabricante_id, codigo, sku, nome, descricao, categoria, categoria_id, estoque, ativo, preco';

export const ProdutosImportQueries = {
  createBatch() {
    return `INSERT INTO produto_import_batches (
      id, account_id, fabricante_id, arquivo_nome, status, total_linhas, linhas_processadas,
      produtos_criados, produtos_atualizados, variacoes_criadas, variacoes_atualizadas, estoques_atualizados,
      erros, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15
    ) RETURNING *`;
  },
  updateBatch() {
    return `UPDATE produto_import_batches SET
      fabricante_id = $3,
      arquivo_nome = $4,
      status = $5,
      total_linhas = $6,
      linhas_processadas = $7,
      produtos_criados = $8,
      produtos_atualizados = $9,
      variacoes_criadas = $10,
      variacoes_atualizadas = $11,
      estoques_atualizados = $12,
      erros = $13,
      updated_at = $14
    WHERE id = $1 AND account_id = $2
    RETURNING *`;
  },
  findBatchById() {
    return 'SELECT * FROM produto_import_batches WHERE id = $1 AND account_id = $2 LIMIT 1';
  },
  listProductsBySku() {
    return `SELECT ${PRODUTOS_IMPORT_SELECT_FIELDS}
      FROM produtos
      WHERE account_id = $1
        AND fabricante_id = $2
        AND sku = ANY($3::text[])`;
  },
  listVariationsByProductIds() {
    return `SELECT ${PRODUTO_VARIACOES_SELECT_FIELDS}
      FROM produto_variacoes
      WHERE account_id = $1
        AND produto_id = ANY($2::uuid[])`;
  },
  findVariationByIdentity() {
    return `SELECT ${PRODUTO_VARIACOES_SELECT_FIELDS}
      FROM produto_variacoes
      WHERE account_id = $1
        AND produto_id = $2
        AND nome = $3
        AND grade = $4
      LIMIT 1`;
  },
  upsertVariation() {
    return `INSERT INTO produto_variacoes (
      account_id, produto_id, sku, nome, valor, cor, grade, estoque_atual, ativo
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (account_id, produto_id, nome, grade)
    DO UPDATE SET
      sku = EXCLUDED.sku,
      valor = EXCLUDED.valor,
      cor = EXCLUDED.cor,
      estoque_atual = EXCLUDED.estoque_atual,
      ativo = EXCLUDED.ativo,
      updated_at = now()
    RETURNING ${PRODUTO_VARIACOES_SELECT_FIELDS}`;
  },
  updateProductActive() {
    return `UPDATE produtos
      SET ativo = $2,
          updated_at = $3
      WHERE account_id = $1 AND id = $4
      RETURNING id`;
  }
};
