export const AnalyticsQueries = {
  summary(whereSql = '') {
    return `SELECT
          COUNT(*)::int AS total_pedidos,
          COALESCE(SUM(total), 0)::numeric AS total_faturado,
          COALESCE(AVG(total), 0)::numeric AS ticket_medio
         FROM pedidos
         ${whereSql ? `${whereSql}` : ''}`;
  },
  statusCounts(whereSql = '') {
    return `SELECT status, COUNT(*)::int AS total
         FROM pedidos
         ${whereSql ? `${whereSql}` : ''}
         GROUP BY status`;
  },
  totalCustomers() {
    return 'SELECT COUNT(*)::int AS total FROM clientes WHERE account_id = $1 AND COALESCE(ativo, true) = true';
  },
  totalProducts() {
    return 'SELECT COUNT(*)::int AS total FROM produtos WHERE account_id = $1 AND COALESCE(ativo, true) = true';
  },
  topProducts(whereSql = '', limitPlaceholder = '') {
    return `SELECT
         pi.produto_id,
         COALESCE(pi.produto_nome, p.nome) AS produto_nome,
         COALESCE(SUM(pi.quantidade), 0)::numeric AS quantidade_vendida,
         COALESCE(SUM(pi.total), 0)::numeric AS total_vendido,
         COUNT(DISTINCT pi.pedido_id)::int AS pedidos
       FROM pedido_itens pi
       INNER JOIN pedidos ped ON ped.id = pi.pedido_id
       LEFT JOIN produtos p ON p.id = pi.produto_id AND p.account_id = ped.account_id
       ${whereSql ? `${whereSql}` : ''}
       GROUP BY pi.produto_id, COALESCE(pi.produto_nome, p.nome)
       ORDER BY total_vendido DESC, produto_nome ASC
       LIMIT ${limitPlaceholder}`;
  },
  topCustomers(whereSql = '', limitPlaceholder = '') {
    return `SELECT
         ped.cliente_id,
         c.nome AS cliente_nome,
         COUNT(*)::int AS pedidos,
         COALESCE(SUM(ped.total), 0)::numeric AS total_comprado
       FROM pedidos ped
       LEFT JOIN clientes c ON c.id = ped.cliente_id AND c.account_id = ped.account_id
       ${whereSql ? `${whereSql}` : ''}
       GROUP BY ped.cliente_id, c.nome
       ORDER BY total_comprado DESC, cliente_nome ASC
       LIMIT ${limitPlaceholder}`;
  },
  salesTimeline(whereSql = '') {
    return `SELECT
         DATE_TRUNC('day', created_at)::date AS date,
         COUNT(*)::int AS pedidos,
         COALESCE(SUM(total), 0)::numeric AS total
       FROM pedidos
       ${whereSql ? `${whereSql}` : ''}
       GROUP BY DATE_TRUNC('day', created_at)::date
       ORDER BY date ASC`;
  }
};
