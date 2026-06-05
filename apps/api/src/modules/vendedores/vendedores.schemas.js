export const listVendedoresQuerySchema = {
  page: { required: false, type: 'number' },
  limit: { required: false, type: 'number' },
  search: { required: false, type: 'string', maxLength: 120 },
  status: { required: false, type: 'string', maxLength: 20 }
};

export const createVendedorSchema = {
  nome: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  email: { required: false, type: 'string', maxLength: 160 },
  telefone: { required: false, type: 'string', maxLength: 40 },
  status: { required: false, type: 'string', maxLength: 20 },
  user_id: { required: false, type: 'string', maxLength: 120 },
  observacoes: { required: false, type: 'string', maxLength: 2000 },
  fabricante_ids: { required: false, type: 'array' }
};

export const updateVendedorSchema = createVendedorSchema;
export const updateVendedorStatusSchema = { status: { required: true, type: 'string', maxLength: 20 } };
export const updateVendedorFabricantesSchema = { fabricante_ids: { required: true, type: 'array' } };
