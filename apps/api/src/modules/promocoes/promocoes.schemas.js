export const createPromocaoSchema = {
  produto_id: { required: true, type: 'string', maxLength: 40 },
  nome: { required: true, type: 'string', minLength: 2, maxLength: 180 },
  descricao: { required: false, type: 'string', maxLength: 2000 },
  percentual_desconto: { required: false, type: 'number' },
  data_inicio: { required: true, type: 'string', maxLength: 20 },
  data_fim: { required: true, type: 'string', maxLength: 20 },
  status: { required: false, type: 'string', maxLength: 20 },
  aplicar_em_todas_variacoes: { required: false, type: 'boolean' },
  variacao_ids: { required: false, type: 'array' },
  variacoesSelecionadas: { required: false, type: 'array' }
};

export const updatePromocaoSchema = {
  nome: { required: false, type: 'string', minLength: 2, maxLength: 180 },
  descricao: { required: false, type: 'string', maxLength: 2000 },
  percentual_desconto: { required: false, type: 'number' },
  data_inicio: { required: false, type: 'string', maxLength: 20 },
  data_fim: { required: false, type: 'string', maxLength: 20 },
  status: { required: false, type: 'string', maxLength: 20 },
  aplicar_em_todas_variacoes: { required: false, type: 'boolean' },
  variacao_ids: { required: false, type: 'array' },
  variacoesSelecionadas: { required: false, type: 'array' }
};
