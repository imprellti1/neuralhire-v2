# Automacoes de Customer Success

Playbooks:
- PB-001 conta em risco
- PB-002 implantacao parada
- PB-003 baixo engajamento
- PB-004 sem pedidos
- PB-005 conta saudavel

Criterios:
- score, churn, engajamento, pedidos e evolucao de milestone.

Severidades:
- baixa, media, alta, critica.

Engine:
- avaliacao sob demanda no endpoint GET de automacoes.
- sem scheduler, cron ou jobs.

Alertas:
- estrutura padrao com id, tipo, titulo, descricao, severidade e playbook.
