export function getAiDirectorDashboard() {
  return {
    health: {
      receita_mes: 124550,
      pedidos_mes: 358,
      clientes_ativos: 78,
      clientes_risco: 15
    },
    alerts: [
      {
        severity: 'high',
        title: 'Faturamento caiu 18% nos últimos 15 dias'
      }
    ],
    opportunities: [
      {
        title: '12 clientes demonstraram intenção de compra'
      }
    ]
  };
}
