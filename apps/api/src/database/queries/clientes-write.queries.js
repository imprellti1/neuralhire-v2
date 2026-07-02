export const ClientesWriteQueries = {
  insert() {
    return `INSERT INTO clientes (
      id, account_id, nome, codigo, documento, email, telefone, site, cidade, estado, status,
      logradouro, numero, complemento, bairro, cep, tags, ativo, metadata, vendedor_id,
      razao_social, digital_enrichment_payload, digital_enrichment_status, digital_enrichment_updated_at,
      enriquecimento_status, enriquecimento_fonte, enriquecimento_ultima_execucao, enriquecimento_erro,
      enriquecimento_payload, geolocalizacao_status, geolocalizacao_fonte, geolocalizacao_erro,
      geolocalizacao_ultima_execucao, latitude, longitude, google_maps_url, google_place_id,
      cliente_score, cliente_classificacao, cliente_potencial, cliente_score_ultima_execucao, cliente_score_fatores,
      updated_at, created_at, owner_user_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24,
      $25, $26, $27, $28,
      $29, $30, $31, $32,
      $33, $34, $35, $36,
      $37, $38, $39, $40, $41,
      $42, $43, $44
    ) RETURNING *`;
  },
  getById() {
    return 'SELECT * FROM clientes WHERE account_id = $1 AND id = $2 LIMIT 1';
  },
  update() {
    return `UPDATE clientes SET
      nome = $3,
      codigo = $4,
      documento = $5,
      email = $6,
      telefone = $7,
      site = $8,
      cidade = $9,
      estado = $10,
      status = $11,
      logradouro = $12,
      numero = $13,
      complemento = $14,
      bairro = $15,
      cep = $16,
      tags = $17,
      ativo = $18,
      metadata = $19,
      vendedor_id = $20,
      razao_social = $21,
      digital_enrichment_payload = $22,
      digital_enrichment_status = $23,
      digital_enrichment_updated_at = $24,
      enriquecimento_status = $25,
      enriquecimento_fonte = $26,
      enriquecimento_ultima_execucao = $27,
      enriquecimento_erro = $28,
      enriquecimento_payload = $29,
      geolocalizacao_status = $30,
      geolocalizacao_fonte = $31,
      geolocalizacao_erro = $32,
      geolocalizacao_ultima_execucao = $33,
      latitude = $34,
      longitude = $35,
      google_maps_url = $36,
      google_place_id = $37,
      cliente_score = $38,
      cliente_classificacao = $39,
      cliente_potencial = $40,
      cliente_score_ultima_execucao = $41,
      cliente_score_fatores = $42,
      updated_at = $43,
      owner_user_id = $44
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  updateEnrichment() {
    return `UPDATE clientes SET
      razao_social = $3,
      nome_fantasia = $4,
      cnae_principal = $5,
      situacao_cadastral = $6,
      data_abertura = $7,
      cep = $8,
      logradouro = $9,
      numero = $10,
      complemento = $11,
      bairro = $12,
      cidade = $13,
      estado = $14,
      email_enriquecido = $15,
      telefone_enriquecido = $16,
      enriquecimento_status = $17,
      enriquecimento_fonte = $18,
      enriquecimento_ultima_execucao = $19,
      enriquecimento_erro = $20,
      enriquecimento_payload = $21,
      updated_at = $22
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  updateGeolocation() {
    return `UPDATE clientes SET
      geolocalizacao_status = $3,
      geolocalizacao_fonte = $4,
      geolocalizacao_erro = $5,
      geolocalizacao_ultima_execucao = $6,
      latitude = $7,
      longitude = $8,
      google_maps_url = $9,
      google_place_id = $10,
      updated_at = $11
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  updateCommercialScore() {
    return `UPDATE clientes SET
      cliente_score = $3,
      cliente_classificacao = $4,
      cliente_potencial = $5,
      cliente_score_ultima_execucao = $6,
      cliente_score_fatores = $7,
      updated_at = $8
    WHERE account_id = $1 AND id = $2
    RETURNING *`;
  },
  listPedidosByCliente() {
    return `SELECT id, account_id, cliente_id, status, total, data_emissao, data_faturamento, metadata, created_at
      FROM pedidos
      WHERE account_id = $1 AND cliente_id = $2
      ORDER BY data_faturamento DESC NULLS LAST, data_emissao DESC NULLS LAST, created_at DESC
      LIMIT 250`;
  },
  listPedidoItensByPedidos() {
    return `SELECT *
      FROM pedido_itens
      WHERE account_id = $1 AND pedido_id = ANY($2)
      ORDER BY pedido_id ASC, id ASC`;
  }
};
