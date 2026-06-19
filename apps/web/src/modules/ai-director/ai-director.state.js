export function createAiDirectorState() {
  return {
    loading: false,
    error: null,
    dashboard: null,
    activeTab: 'overview',
    memories: [],
    executiveMemories: [],
    executiveMemoriesFilter: 'all',
    actionPlans: [],
    actionPlansFilter: {
      status: 'all',
      gerente_responsavel: 'all'
    },
    tasks: [],
    tasksFilter: {
      status: 'all',
      priority: 'all',
      manager: 'all',
      category: 'all'
    },
    observations: [],
    observationsFilter: 'all',
    events: [],
    eventsFilter: 'all',
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
    taskActionLoadingId: null,
    taskActionMessage: null,
    taskActionError: null,
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
