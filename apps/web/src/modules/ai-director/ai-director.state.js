export function createAiDirectorState() {
  return {
    loading: false,
    error: null,
    dashboard: null,
    memories: [],
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
    answer: 'Módulo de perguntas será ativado na ETAPA 5.'
  };
}
