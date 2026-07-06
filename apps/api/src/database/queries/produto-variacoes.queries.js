export const PRODUTO_VARIACOES_SELECT_FIELDS = 'id, account_id, produto_id, sku, nome, valor, cor, grade, estoque_atual, preco, preco_promocional, multiplo_venda, ativo, imagem_url, imagem_path, created_at, updated_at';

export const ProdutoVariacoesQueries = {
  listByProduto() {
    return `SELECT ${PRODUTO_VARIACOES_SELECT_FIELDS}
      FROM produto_variacoes
      WHERE account_id = $1 AND produto_id = $2
      ORDER BY created_at ASC, id ASC`;
  },
  findById() {
    return `SELECT ${PRODUTO_VARIACOES_SELECT_FIELDS}
      FROM produto_variacoes
      WHERE account_id = $1 AND id = $2
      LIMIT 1`;
  },
  updateImagem() {
    return `UPDATE produto_variacoes
      SET imagem_url = $3,
          imagem_path = $4,
          updated_at = $5
      WHERE account_id = $1 AND produto_id = $2 AND id = $6
      RETURNING ${PRODUTO_VARIACOES_SELECT_FIELDS}`;
  }
};
