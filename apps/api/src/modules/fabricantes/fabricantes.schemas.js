export const listFabricantesQuerySchema = {
  page: { required: false, type: 'number' },
  limit: { required: false, type: 'number' },
  search: { required: false, type: 'string', maxLength: 120 },
  status: { required: false, type: 'string', maxLength: 20 }
};

export const createFabricanteSchema = {
  nome: { required: false, type: 'string', minLength: 2, maxLength: 180 },
  razao_social: { required: false, type: 'string', maxLength: 180 },
  cnpj: { required: false, type: 'string', maxLength: 20 },
  site: { required: false, type: 'string', maxLength: 500 },
  email_comercial: { required: false, type: 'string', maxLength: 180 },
  telefone: { required: false, type: 'string', maxLength: 40 },
  regiao_atendida: { required: false, type: 'string', maxLength: 120 },
  logradouro: { required: false, type: 'string', maxLength: 180 },
  numero: { required: false, type: 'string', maxLength: 60 },
  complemento: { required: false, type: 'string', maxLength: 180 },
  bairro: { required: false, type: 'string', maxLength: 120 },
  cidade: { required: false, type: 'string', maxLength: 120 },
  uf: { required: false, type: 'string', maxLength: 10 },
  cep: { required: false, type: 'string', maxLength: 20 },
  endereco_completo: { required: false, type: 'string', maxLength: 500 },
  logo_url: { required: false, type: 'string', maxLength: 500 },
  status: { required: false, type: 'string', maxLength: 20 },
  valor_minimo_duplicata: { required: false, type: 'number' },
  pedido_minimo_valor: { required: false, type: 'number' },
  pedido_minimo_itens: { required: false, type: 'number' },
  prazo_entrega_dias: { required: false, type: 'number' },
  comissao_padrao_percentual: { required: false, type: 'number' },
  politica_troca: { required: false, type: 'string', maxLength: 2000 },
  aceita_bonificacao: { required: false, type: 'boolean' },
  aceita_consignacao: { required: false, type: 'boolean' },
  condicoes_pagamento: { required: false, type: 'array' },
  observacoes_comerciais: { required: false, type: 'string', maxLength: 4000 },
  tabela_precos_url: { required: false, type: 'string', maxLength: 500 },
  responsavel_vendedor_id: { required: false, type: 'string', maxLength: 120 },
  observacoes: { required: false, type: 'string', maxLength: 2000 }
};

export const updateFabricanteSchema = createFabricanteSchema;

export const createCondicaoPagamentoSchema = null;

export const updateCondicaoPagamentoSchema = createCondicaoPagamentoSchema;

export const deleteCondicaoPagamentoSchema = null;

export const cnpjLookupSchema = {
  cnpj: { required: true, type: 'string', minLength: 14, maxLength: 20 }
};
