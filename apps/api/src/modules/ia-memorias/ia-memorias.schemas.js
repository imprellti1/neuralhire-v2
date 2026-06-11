export const createIaMemoriaSchema = {
  tipo: { required: true, type: 'string', maxLength: 80 },
  titulo: { required: true, type: 'string', maxLength: 200 },
  conteudo: { required: true, type: 'string', maxLength: 10000 },
  tags: { required: false, type: 'array' },
  prioridade: { required: false, type: 'number' },
  origem: { required: false, type: 'string', maxLength: 180 },
  modulo: { required: false, type: 'string', maxLength: 120 },
  status: { required: false, type: 'string', maxLength: 20 },
  metadata: { required: false, type: 'object' }
};

export const updateIaMemoriaSchema = {
  tipo: { required: false, type: 'string', maxLength: 80 },
  titulo: { required: false, type: 'string', maxLength: 200 },
  conteudo: { required: false, type: 'string', maxLength: 10000 },
  tags: { required: false, type: 'array' },
  prioridade: { required: false, type: 'number' },
  origem: { required: false, type: 'string', maxLength: 180 },
  modulo: { required: false, type: 'string', maxLength: 120 },
  status: { required: false, type: 'string', maxLength: 20 },
  metadata: { required: false, type: 'object' }
};

