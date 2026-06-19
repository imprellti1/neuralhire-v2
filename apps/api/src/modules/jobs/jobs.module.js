import { defineModule } from '../../core/module-contract.js';

export const jobsModule = defineModule({
  name: 'jobs',
  domain: 'system-jobs',
  routes: [
    'GET /jobs',
    'GET /jobs/runs',
    'GET /jobs/:id',
    'POST /jobs/radar-comercial/run',
    'POST /jobs/clientes-enriquecimento/run',
    'POST /jobs/clientes-geolocalizacao/run',
    'POST /jobs/notificacoes-resumo-semanal/run',
    'POST /jobs/gerente-comercial-observacao/run',
    'POST /jobs/diretor-delegacao/run'
  ]
});
