import { __resetMemoryAlertasForTests, __resetClientesAlertsForTests } from '../modules/clientes/clientes.alerts.service.js';
import { __resetClientesRadarForTests } from '../modules/clientes/clientes.radar.service.js';
import { __resetMemoryClientesForTests, __setClientesSupabaseClientForTests } from '../modules/clientes/clientes.repository.js';
import { __resetClientesSegmentacaoForTests } from '../modules/clientes/clientes.segmentacao.service.js';
import { __resetMemoryTimelineForTests, __resetClientesTimelineForTests } from '../modules/clientes/clientes.timeline.service.js';
import { __resetMemoryPedidosForTests } from '../modules/pedidos/pedidos.repository.js';
import { __resetMemoryAiDirectorForTests } from '../modules/ai-director/ai-director.repository.js';
import { __resetMemoryAiDirectorActionPlansForTests } from '../modules/ai-director/ai-director-action-plans.repository.js';
import { __resetMemoryAiDirectorTasksForTests } from '../modules/ai-director/ai-director-tasks.repository.js';
import { __resetMemoryAiDirectorObservationsForTests } from '../modules/ai-director-observations/ai-director-observations.repository.js';
import { __resetSystemJobsForTests } from '../modules/jobs/jobs.repository.js';
import { __resetJobsSchedulerForTests } from '../modules/jobs/jobs.scheduler.js';
import { __dumpMemoryAiDirectorForTests, __dumpAiDirectorTestStateForTests } from '../modules/ai-director/ai-director.repository.js';
import { __dumpMemoryAiDirectorActionPlansForTests } from '../modules/ai-director/ai-director-action-plans.repository.js';
import { __dumpSystemJobsForTests } from '../modules/jobs/jobs.repository.js';

function snapshot() {
  const aiDirector = __dumpAiDirectorTestStateForTests();
  const jobs = __dumpSystemJobsForTests();
  const actionPlans = __dumpMemoryAiDirectorActionPlansForTests();
  return {
    clientes: 0,
    pedidos: 0,
    aiDirectorMemories: __dumpMemoryAiDirectorForTests().length,
    aiDirectorManagerOverrides: aiDirector.managerOverrides,
    aiDirectorSupabaseOverrideActive: aiDirector.supabaseOverrideActive,
    aiDirectorSupabaseOverrideConfigured: aiDirector.supabaseOverrideConfigured,
    actionPlans: actionPlans.length,
    jobs: jobs.jobs.length,
    jobRuns: jobs.runs.length,
    jobLogs: jobs.logs.length,
    jobsSupabaseOverrideActive: jobs.supabaseOverrideActive,
    jobsSupabaseOverrideConfigured: jobs.supabaseOverrideConfigured
  };
}

export function resetApiTestState() {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryAlertasForTests();
  __resetMemoryTimelineForTests();
  __setClientesSupabaseClientForTests(null, false);
  __resetClientesAlertsForTests();
  __resetClientesTimelineForTests();
  __resetClientesSegmentacaoForTests();
  __resetClientesRadarForTests();
  __resetMemoryAiDirectorForTests();
  __resetMemoryAiDirectorActionPlansForTests();
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorObservationsForTests();
  __resetSystemJobsForTests();
  __resetJobsSchedulerForTests();
}

export function dumpApiTestState() {
  return snapshot();
}
