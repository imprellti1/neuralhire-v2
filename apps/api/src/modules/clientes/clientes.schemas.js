export const listClientesQuerySchema = {
  page: {
    required: false,
    type: 'number'
  },
  limit: {
    required: false,
    type: 'number'
  },
  search: {
    required: false,
    type: 'string',
    maxLength: 120
  },
  ativo: {
    required: false,
    type: 'boolean'
  }
};

export const createClienteSchema = {
  nome: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 120
  },
  documento: {
    required: false,
    type: 'string',
    maxLength: 30
  },
  email: {
    required: false,
    type: 'string',
    maxLength: 120
  },
  telefone: {
    required: false,
    type: 'string',
    maxLength: 30
  },
  cidade: {
    required: false,
    type: 'string',
    maxLength: 120
  },
  estado: {
    required: false,
    type: 'string',
    maxLength: 2
  },
  tags: {
    required: false,
    type: 'array'
  },
  owner_user_id: {
    required: false,
    type: 'string',
    maxLength: 120
  },
  vendedor_id: {
    required: false,
    type: 'string',
    maxLength: 120
  }
};
