export const PromocoesQueries = {
  ping() {
    return 'SELECT 1 AS ok';
  },
  listPromocoes() {
    return `SELECT *
      FROM produto_promocoes
      WHERE account_id = $1
      ORDER BY created_at DESC`;
  },
  getPromocaoById() {
    return `SELECT *
      FROM produto_promocoes
      WHERE account_id = $1 AND id = $2
      LIMIT 1`;
  },
  insertPromocao() {
    return `INSERT INTO produto_promocoes (
      id, account_id, produto_id, nome, descricao, percentual_desconto, data_inicio, data_fim, status, aplicar_em_todas_variacoes, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING *`;
  },
  updatePromocao() {
    return `UPDATE produto_promocoes SET
      produto_id = $3,
      nome = $4,
      descricao = $5,
      percentual_desconto = $6,
      data_inicio = $7,
      data_fim = $8,
      status = $9,
      aplicar_em_todas_variacoes = $10,
      updated_at = $11
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  deletePromocaoLinks() {
    return 'DELETE FROM produto_promocao_variacoes WHERE account_id = $1 AND promocao_id = $2';
  },
  deletePromocaoProdutos() {
    return 'DELETE FROM produto_promocao_produtos WHERE account_id = $1 AND promocao_id = $2';
  },
  insertPromocaoProduto() {
    return `INSERT INTO produto_promocao_produtos (
      id, account_id, promocao_id, produto_id, aplicar_em_todas_variacoes, percentual_desconto, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    ) RETURNING *`;
  },
  listPromocaoProdutos() {
    return `SELECT *
      FROM produto_promocao_produtos
      WHERE account_id = $1 AND promocao_id = $2
      ORDER BY created_at ASC, id ASC`;
  },
  insertPromocaoVariacao() {
    return `INSERT INTO produto_promocao_variacoes (
      id, account_id, promocao_id, promocao_produto_id, produto_id, variacao_id, percentual_desconto, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    ) RETURNING *`;
  },
  listPromocaoVariacoes() {
    return `SELECT *
      FROM produto_promocao_variacoes
      WHERE account_id = $1 AND promocao_id = $2
      ORDER BY created_at ASC, id ASC`;
  },
  listPromocoesByIds() {
    return `SELECT *
      FROM produto_promocoes
      WHERE account_id = $1 AND id = ANY($2::uuid[])`;
  },
  listPromocaoProdutosByPromocaoIds() {
    return `SELECT *
      FROM produto_promocao_produtos
      WHERE account_id = $1 AND promocao_id = ANY($2::uuid[])`;
  },
  listPromocaoVariacoesByPromocaoIds() {
    return `SELECT *
      FROM produto_promocao_variacoes
      WHERE account_id = $1 AND promocao_id = ANY($2::uuid[])`;
  }
};
