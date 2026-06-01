export function createClienteCreateState() {
  return {
    empresa: '',
    razao_social: '',
    nome_contato: '',
    email: '',
    telefone: '',
    cidade: '',
    uf: '',
    status: 'ativo',
    observacoes: '',
    saving: false,
    error: '',
    success: ''
  };
}
