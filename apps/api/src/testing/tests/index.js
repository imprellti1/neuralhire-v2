import { runTestSuite } from '../test-runner.js';
import { getAuthTests } from './auth.test.js';
import { getRbacTests } from './rbac.test.js';
import { getValidationTests } from './validation.test.js';
import { getPublicRouteTests } from './public-routes.test.js';
import { getCorsTests } from './cors.test.js';
import { getPayloadLimitTests } from './payload-limit.test.js';
import { getScopesTests } from './scopes.test.js';
import { getClientesRepositoryTests } from './clientes-repository.test.js';
import { getClientesPaginationTests } from './clientes-pagination.test.js';
import { getClientesTenantTests } from './clientes-tenant.test.js';
import { getClientesRlsContractTests } from './clientes-rls-contract.test.js';
import { getProdutosRepositoryTests } from './produtos-repository.test.js';
import { getProdutosPaginationTests } from './produtos-pagination.test.js';
import { getProdutosTenantTests } from './produtos-tenant.test.js';
import { getProdutosSearchTests } from './produtos-search.test.js';
import { getPedidosRepositoryTests } from './pedidos-repository.test.js';
import { getPedidosPaginationTests } from './pedidos-pagination.test.js';
import { getPedidosTenantTests } from './pedidos-tenant.test.js';
import { getPedidosCreateRbacTests } from './pedidos-create-rbac.test.js';
import { getPedidosCalculationTests } from './pedidos-calculation.test.js';
import { getPedidosStatusTests } from './pedidos-status.test.js';
import { getPedidosStatusUpdateTests } from './pedidos-status-update.test.js';
import { getPedidosStatusRulesTests } from './pedidos-status-rules.test.js';
import { getPedidosAuditTests } from './pedidos-audit.test.js';
import { getPedidosItensUpdateTests } from './pedidos-itens-update.test.js';
import { getPedidosUpdateTests } from './pedidos-update.test.js';
import { getAnalyticsSummaryTests } from './analytics-summary.test.js';
import { getAnalyticsProductsTests } from './analytics-products.test.js';
import { getAnalyticsCustomersTests } from './analytics-customers.test.js';
import { getAnalyticsPeriodsTests } from './analytics-periods.test.js';
import { getAnalyticsTenantTests } from './analytics-tenant.test.js';
import { getAnalyticsDateValidationTests } from './analytics-date-validation.test.js';
import { getCommercialOwnershipTests } from './commercial-ownership.test.js';

async function main() {
  const suites = [
    ['Auth', getAuthTests()], ['RBAC', getRbacTests()], ['Validation', getValidationTests()], ['Public Routes', getPublicRouteTests()], ['CORS', getCorsTests()], ['Payload Limit', getPayloadLimitTests()], ['Scopes', getScopesTests()], ['Clientes Repository', getClientesRepositoryTests()], ['Clientes Pagination', getClientesPaginationTests()], ['Clientes Tenant', getClientesTenantTests()], ['Clientes RLS Contract', getClientesRlsContractTests()], ['Produtos Repository', getProdutosRepositoryTests()], ['Produtos Pagination', getProdutosPaginationTests()], ['Produtos Tenant', getProdutosTenantTests()], ['Produtos Search', getProdutosSearchTests()], ['Pedidos Repository', getPedidosRepositoryTests()], ['Pedidos Pagination', getPedidosPaginationTests()], ['Pedidos Tenant', getPedidosTenantTests()], ['Pedidos Create RBAC', getPedidosCreateRbacTests()], ['Pedidos Calculation', getPedidosCalculationTests()], ['Pedidos Status', getPedidosStatusTests()], ['Pedidos Status Update', getPedidosStatusUpdateTests()], ['Pedidos Status Rules', getPedidosStatusRulesTests()], ['Pedidos Audit', getPedidosAuditTests()], ['Pedidos Itens Update', getPedidosItensUpdateTests()], ['Pedidos Update', getPedidosUpdateTests()], ['Analytics Summary', getAnalyticsSummaryTests()], ['Analytics Products', getAnalyticsProductsTests()], ['Analytics Customers', getAnalyticsCustomersTests()], ['Analytics Periods', getAnalyticsPeriodsTests()], ['Analytics Tenant', getAnalyticsTenantTests()], ['Analytics Date Validation', getAnalyticsDateValidationTests()], ['Commercial Ownership', getCommercialOwnershipTests()]
  ];

  const summary = { total: 0, passed: 0, failed: 0 };
  for (const [name, tests] of suites) {
    const result = await runTestSuite(name, tests);
    summary.total += result.total;
    summary.passed += result.passed;
    summary.failed += result.failed;
  }

  console.log('\n=== API Test Summary ===');
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  if (summary.failed > 0) process.exitCode = 1;
}

main();

