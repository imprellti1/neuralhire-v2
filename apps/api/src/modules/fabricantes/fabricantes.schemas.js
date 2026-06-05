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
  pedido_minimo: { required: false, type: 'number' },
  boleto_minimo: { required: false, type: 'number' },
  comissao_padrao_percentual: { required: false, type: 'number' },
  observacoes: { required: false, type: 'string', maxLength: 2000 }
};

export const updateFabricanteSchema = createFabricanteSchema;

export const createCondicaoPagamentoSchema = {
  nome: { required: true, type: 'string', minLength: 2, maxLength: 180 },
  codigo: { required: false, type: 'string', maxLength: 60 },
  parcelas: { required: false, type: 'number' },
  prazo_medio_dias: { required: false, type: 'number' },
  valor_minimo: { required: false, type: 'number' },
  percentual_acrescimo: { required: false, type: 'number' },
  ativo: { required: false, type: 'boolean' },
  observacoes: { required: false, type: 'string', maxLength: 2000 }
};

export const updateCondicaoPagamentoSchema = createCondicaoPagamentoSchema;

export const deleteCondicaoPagamentoSchema = null;

export const cnpjLookupSchema = {
  cnpj: { required: true, type: 'string', minLength: 14, maxLength: 20 }
};
