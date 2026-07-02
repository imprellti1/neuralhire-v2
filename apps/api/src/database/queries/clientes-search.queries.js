export const ClientesSearchQueries = {
  countByWhere(whereSql = '') {
    return `SELECT COUNT(*)::int AS total
      FROM clientes
      ${whereSql ? `${whereSql}` : ''}`;
  },
  listByWhere(whereSql = '', orderSql = '', limitPlaceholder = '', offsetPlaceholder = '') {
    return `SELECT *
      FROM clientes
      ${whereSql ? `${whereSql}` : ''}
      ${orderSql ? `${orderSql}` : ''}
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}`;
  }
};
