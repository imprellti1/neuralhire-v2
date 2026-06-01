export function mapClienteCreatePayload(state = {}) {
  const empresa = String(state.empresa || '').trim();
  return {
    nome: empresa,
    empresa,
    razao_social: String(state.razao_social || '').trim() || undefined,
    nome_contato: String(state.nome_contato || '').trim() || undefined,
    email: String(state.email || '').trim() || undefined,
    telefone: String(state.telefone || '').trim() || undefined,
    cidade: String(state.cidade || '').trim() || undefined,
    estado: String(state.uf || '').trim().toUpperCase() || undefined,
    uf: String(state.uf || '').trim().toUpperCase() || undefined,
    status: String(state.status || 'ativo').trim() || 'ativo',
    observacoes: String(state.observacoes || '').trim() || undefined
  };
}
