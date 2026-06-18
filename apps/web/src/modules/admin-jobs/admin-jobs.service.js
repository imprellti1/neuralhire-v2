export async function fetchAdminJobs(apiClient) {
  return apiClient.get('/jobs');
}

export async function fetchAdminJobRuns(apiClient, filters = {}) {
  return apiClient.get('/jobs/runs', filters);
}

export async function fetchAdminJob(apiClient, id) {
  return apiClient.get(`/jobs/${id}`);
}

export async function runAdminJob(apiClient, jobId) {
  if (!jobId) throw new Error('Job sem identificador');
  return apiClient.post(`/jobs/${jobId}/run`);
}
