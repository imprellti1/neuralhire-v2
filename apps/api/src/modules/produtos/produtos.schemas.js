export const createProdutoSchema = {
  codigo: { required: false, type: 'string', maxLength: 60 },
  sku: { required: false, type: 'string', maxLength: 60 },
  nome: { required: true, type: 'string', minLength: 2, maxLength: 180 },
  descricao: { required: false, type: 'string', maxLength: 2000 },
  categoria: { required: false, type: 'string', maxLength: 120 },
  marca: { required: false, type: 'string', maxLength: 120 },
  preco: { required: false, type: 'number' },
  custo: { required: false, type: 'number' },
  estoque: { required: false, type: 'number' },
  unidade: { required: false, type: 'string', maxLength: 10 },
  ativo: { required: false, type: 'boolean' },
  tags: { required: false, type: 'array' }
};

export const listProdutosQuerySchema = {
  page: { required: false, type: 'number' },
  limit: { required: false, type: 'number' },
  search: { required: false, type: 'string', maxLength: 120 },
  categoria: { required: false, type: 'string', maxLength: 120 },
  marca: { required: false, type: 'string', maxLength: 120 },
  ativo: { required: false, type: 'boolean' }
};

export const updateProdutoSchema = {
  nome: { required: false, type: 'string', minLength: 2, maxLength: 180 },
  descricao: { required: false, type: 'string', maxLength: 2000 },
  sku: { required: false, type: 'string', maxLength: 60 },
  categoria: { required: false, type: 'string', maxLength: 120 },
  preco: { required: false, type: 'number' },
  preco_unitario: { required: false, type: 'number' },
  status: { required: false, type: 'string', maxLength: 20 },
  ativo: { required: false, type: 'boolean' }
};
