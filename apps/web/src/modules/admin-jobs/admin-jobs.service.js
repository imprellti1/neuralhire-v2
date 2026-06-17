export async function fetchAdminJobs(apiClient) {
  return apiClient.get('/jobs');
}

export async function fetchAdminJobRuns(apiClient, filters = {}) {
  return apiClient.get('/jobs/runs', filters);
}

export async function fetchAdminJob(apiClient, id) {
  return apiClient.get(`/jobs/${id}`);
}

export async function runAdminJob(apiClient, jobName) {
  const mapping = {
    radar_comercial_diario: '/jobs/radar-comercial/run',
    clientes_enriquecimento_automatico: '/jobs/clientes-enriquecimento/run',
    clientes_geolocalizacao_automatico: '/jobs/clientes-geolocalizacao/run',
    notificacoes_resumo_semanal: '/jobs/notificacoes-resumo-semanal/run'
  };
  const path = mapping[jobName];
  if (!path) throw new Error('Job desconhecido');
  return apiClient.post(path);
}
