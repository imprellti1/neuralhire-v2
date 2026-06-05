export function createFabricantesState() {
  return {
    loading: false,
    saving: false,
    error: false,
    empty: false,
    retry: false,
    success: false,
    search: '',
    status: '',
    items: [],
    selected: null,
    condicoes: [],
    modalOpen: false,
    modalTab: 'gerais',
    cnpjLookupStatus: 'idle',
    cnpjManualUnlock: false,
    cnpjValidated: false,
    cnpjMessage: '',
    form: {
      cnpj: '',
      nome: '',
      razao_social: '',
      nome_fantasia: '',
      email_comercial: '',
      telefone: '',
      site: '',
      logo_url: '',
      responsavel_comercial: '',
      regiao_atendida: '',
      observacoes: '',
      pedido_minimo: 0,
      boleto_minimo: 0,
      comissao_padrao_percentual: 0,
      condicoes_pagamento: ''
    },
    saveBlocked: true
  };
}
