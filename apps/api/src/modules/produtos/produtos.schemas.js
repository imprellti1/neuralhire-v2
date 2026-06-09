export const createProdutoSchema = {
  codigo: { required: false, type: 'string', maxLength: 60 },
  sku: { required: false, type: 'string', maxLength: 60 },
  nome: { required: true, type: 'string', minLength: 2, maxLength: 180 },
  descricao: { required: false, type: 'string', maxLength: 2000 },
  categoria_id: { required: false, type: 'string', maxLength: 40 },
  categoria: { required: false, type: 'string', maxLength: 120 },
  marca: { required: false, type: 'string', maxLength: 120 },
  fabricante_id: { required: false, type: 'string', maxLength: 40 },
  preco: { required: false, type: 'number' },
  preco_promocional: { required: false, type: 'number' },
  icms_percentual: { required: false, type: 'number' },
  multiplo_venda: { required: false, type: 'number' },
  video_url: { required: false, type: 'string', maxLength: 500 },
  imagem_url: { required: false, type: 'string', maxLength: 500 },
  imagem_path: { required: false, type: 'string', maxLength: 500 },
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
  categoria_id: { required: false, type: 'string', maxLength: 40 },
  categoria: { required: false, type: 'string', maxLength: 120 },
  marca: { required: false, type: 'string', maxLength: 120 },
  ativo: { required: false, type: 'boolean' }
};

export const updateProdutoSchema = {
  nome: { required: false, type: 'string', minLength: 2, maxLength: 180 },
  descricao: { required: false, type: 'string', maxLength: 2000 },
  sku: { required: false, type: 'string', maxLength: 60 },
  categoria_id: { required: false, type: 'string', maxLength: 40 },
  categoria: { required: false, type: 'string', maxLength: 120 },
  fabricante_id: { required: false, type: 'string', maxLength: 40 },
  preco: { required: false, type: 'number' },
  preco_unitario: { required: false, type: 'number' },
  preco_promocional: { required: false, type: 'number' },
  icms_percentual: { required: false, type: 'number' },
  multiplo_venda: { required: false, type: 'number' },
  video_url: { required: false, type: 'string', maxLength: 500 },
  imagem_url: { required: false, type: 'string', maxLength: 500 },
  imagem_path: { required: false, type: 'string', maxLength: 500 },
  status: { required: false, type: 'string', maxLength: 20 },
  ativo: { required: false, type: 'boolean' }
};
