export function createAiDirectorState() {
  return {
    loading: false,
    error: null,
    dashboard: null,
    memories: [],
    executiveMemories: [],
    executiveMemoriesFilter: 'all',
    managers: [],
    managersLoading: false,
    managerConsultations: {},
    managerQuestion: '',
    memoryForm: {
      tipo: 'observacao',
      titulo: '',
      conteudo: '',
      prioridade: 'media'
    },
    savingMemory: false,
    memoryError: null,
    question: '',
    answer: 'Módulo de perguntas será ativado na ETAPA 5.',
    delegationLoading: false,
    delegationResult: null,
    delegationError: null,
    askLoading: false,
    askResult: null,
    askError: null,
    autoRefreshEnabled: true,
    autoRefreshLoading: false,
    autoRefreshError: null,
    lastAutoRefreshAt: null
  };
}
