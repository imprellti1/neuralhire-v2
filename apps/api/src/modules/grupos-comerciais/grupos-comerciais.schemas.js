export const grupoComercialSchema = { type: 'object', required: ['nome'], properties: { nome: { type: 'string', minLength: 2 }, descricao: { type: 'string' }, ativo: { type: 'boolean' } } };
export const grupoComercialClientesSchema = { type: 'object', properties: { clienteId: { type: 'string' }, clienteIds: { type: 'array' } } };
