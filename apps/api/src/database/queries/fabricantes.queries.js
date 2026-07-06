export const FabricantesQueries = {
  ping() {
    return 'SELECT 1 AS ok';
  },
  list(whereSql = '') {
    const extraWhere = whereSql ? ` AND ${whereSql}` : '';
    return `SELECT * FROM fabricantes WHERE account_id = $1${extraWhere} ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
  },
  count(whereSql = '') {
    const extraWhere = whereSql ? ` WHERE ${whereSql}` : '';
    return `SELECT COUNT(*)::int AS total FROM fabricantes${extraWhere}`;
  },
  getById() {
    return 'SELECT * FROM fabricantes WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  insert() {
    return `INSERT INTO fabricantes (
      id, account_id, nome, razao_social, cnpj, site, email_comercial, telefone, regiao_atendida,
      logradouro, numero, complemento, bairro, cidade, uf, cep, endereco_completo, logo_url, status,
      valor_minimo_duplicata, pedido_minimo_valor, pedido_minimo_itens, prazo_entrega_dias, comissao_padrao_percentual,
      politica_troca, aceita_bonificacao, aceita_consignacao, condicoes_pagamento, observacoes_comerciais,
      tabela_precos_url, pedido_minimo, boleto_minimo, observacoes, responsavel_vendedor_id, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24,
      $25, $26, $27, $28, $29,
      $30, $31, $32, $33, $34, $35, $36
    ) RETURNING *`;
  },
  update() {
    return `UPDATE fabricantes SET
      nome = $3,
      razao_social = $4,
      cnpj = $5,
      site = $6,
      email_comercial = $7,
      telefone = $8,
      regiao_atendida = $9,
      logradouro = $10,
      numero = $11,
      complemento = $12,
      bairro = $13,
      cidade = $14,
      uf = $15,
      cep = $16,
      endereco_completo = $17,
      logo_url = $18,
      status = $19,
      valor_minimo_duplicata = $20,
      pedido_minimo_valor = $21,
      pedido_minimo_itens = $22,
      prazo_entrega_dias = $23,
      comissao_padrao_percentual = $24,
      politica_troca = $25,
      aceita_bonificacao = $26,
      aceita_consignacao = $27,
      condicoes_pagamento = $28,
      observacoes_comerciais = $29,
      tabela_precos_url = $30,
      pedido_minimo = $31,
      boleto_minimo = $32,
      observacoes = $33,
      responsavel_vendedor_id = $34,
      updated_at = $35
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  listVendedores() {
    return `SELECT * FROM fabricante_vendedores WHERE account_id = $1 AND fabricante_id = $2 ORDER BY principal DESC, created_at DESC`;
  },
  deleteVendedores() {
    return 'DELETE FROM fabricante_vendedores WHERE account_id = $1 AND fabricante_id = $2';
  },
  insertVendedor() {
    return `INSERT INTO fabricante_vendedores (
      id, account_id, fabricante_id, vendedor_id, principal, status, comissao_percentual,
      pedido_minimo_valor, valor_minimo_duplicata, condicoes_pagamento, observacoes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;
  },
  updateVendedor() {
    return `UPDATE fabricante_vendedores SET
      principal = $5,
      status = $6,
      comissao_percentual = $7,
      pedido_minimo_valor = $8,
      valor_minimo_duplicata = $9,
      condicoes_pagamento = $10,
      observacoes = $11,
      updated_at = $12
    WHERE account_id = $1 AND fabricante_id = $2 AND vendedor_id = $3
    RETURNING *`;
  },
  deleteVendedor() {
    return 'DELETE FROM fabricante_vendedores WHERE account_id = $1 AND fabricante_id = $2 AND vendedor_id = $3';
  }
};
