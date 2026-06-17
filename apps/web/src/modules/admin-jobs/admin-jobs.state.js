export function createAdminJobsState() {
  return {
    loading: true,
    error: null,
    jobs: [],
    runs: [],
    selectedJobId: '',
    selectedJob: null,
    successMessage: '',
    runFilters: { nome: '', status: '', job_id: '', limit: 20 },
    refreshing: false
  };
}
