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
import { getInterestLeadsCreateTests } from './interest-leads-create.test.js';
import { getInterestLeadsValidationTests } from './interest-leads-validation.test.js';
import { getInterestLeadsListTests } from './interest-leads-list.test.js';
import { getInterestLeadsStatusTests } from './interest-leads-status.test.js';
import { getInterestLeadsExportTests } from './interest-leads-export.test.js';
import { getInterestLeadsDashboardTests } from './interest-leads-dashboard.test.js';
import { getInterestLeadsEventsTests } from './interest-leads-events.test.js';
import { getInterestLeadsRepositoryTests } from './interest-leads-repository.test.js';
import { getInterestLeadsInviteTests } from './interest-leads-invite.test.js';
import { getInterestLeadsBulkBatchTests } from './interest-leads-bulk-batch.test.js';
import { getInterestLeadsLaunchDashboardTests } from './interest-leads-launch-dashboard.test.js';
import { getInterestLeadsConvertTests } from './interest-leads-convert.test.js';
import { getLaunchTemplatesTests } from './launch-templates.test.js';
import { getLaunchPreviewTests } from './launch-preview.test.js';
import { getLaunchQueueTests } from './launch-queue.test.js';
import { getOnboardingStartTests } from './onboarding-start.test.js';
import { getOnboardingStepTests } from './onboarding-step.test.js';
import { getOnboardingCompleteTests } from './onboarding-complete.test.js';
import { getJornadaComercialE2ETests } from './jornada-comercial-e2e.test.js';
import { getLeadToAccountTrialTests } from './lead-to-account-trial.test.js';
import { getBillingOnboardingIntegrationTests } from './billing-onboarding-integration.test.js';
import { getAccountActivationStatusTests } from './account-activation-status.test.js';
import { getImplementationStatusTests } from './implementation-status.test.js';
import { getCustomerSuccessTests } from './customer-success.test.js';
import { getCustomerSuccessAutomationTests } from './customer-success-automation.test.js';
import { getCustomerSuccessTimelineTests } from './customer-success-timeline.test.js';
import { getPortfolioDashboardTests } from './portfolio-dashboard.test.js';
import { getExecutivePortfolioAnalyticsTests } from './executive-portfolio-analytics.test.js';
import { getFabricantesTests } from './fabricantes.test.js';
import { getLegacyImportTests } from './legacy-import.test.js';
import { getLegacyImportStagingTests } from './legacy-import-staging.test.js';
import { getLegacyImportApprovalTests } from './legacy-import-approval.test.js';
import { getLegacyImportPromotionTests } from './legacy-import-promotion.test.js';
import { getCustomerMemoryTests } from './customer-memory.test.js';
import { getWhatsappContextTests } from './whatsapp-context.test.js';
import { getWhatsappConversationsTests } from './whatsapp-conversations.test.js';
import { getWhatsappDraftStateTests } from './whatsapp-draft-state.test.js';
import { getMessageDraftsTests } from './message-drafts.test.js';
import { getActionAwareDraftsTests } from './action-aware-drafts.test.js';
import { getMessageApprovalsTests } from './message-approvals.test.js';
import { getWhatsappDeliveryTests } from './whatsapp-delivery.test.js';
import { getCommercialAgentTests } from './commercial-agent.test.js';
import { getApprovalIntelligenceTests } from './approval-intelligence.test.js';
import { getProductAuditTests } from './product-audit.test.js';
import { getProductEditorTests } from './product-editor.test.js';

async function main() {
  const suites = [
    ['Auth', getAuthTests()],
    ['RBAC', getRbacTests()],
    ['Validation', getValidationTests()],
    ['Public Routes', getPublicRouteTests()],
    ['CORS', getCorsTests()],
    ['Payload Limit', getPayloadLimitTests()],
    ['Scopes', getScopesTests()],
    ['Clientes Repository', getClientesRepositoryTests()],
    ['Clientes Pagination', getClientesPaginationTests()],
    ['Clientes Tenant', getClientesTenantTests()],
    ['Clientes RLS Contract', getClientesRlsContractTests()],
    ['Produtos Repository', getProdutosRepositoryTests()],
    ['Produtos Pagination', getProdutosPaginationTests()],
    ['Produtos Tenant', getProdutosTenantTests()],
    ['Produtos Search', getProdutosSearchTests()],
    ['Pedidos Repository', getPedidosRepositoryTests()],
    ['Pedidos Pagination', getPedidosPaginationTests()],
    ['Pedidos Tenant', getPedidosTenantTests()],
    ['Pedidos Create RBAC', getPedidosCreateRbacTests()],
    ['Pedidos Calculation', getPedidosCalculationTests()],
    ['Pedidos Status', getPedidosStatusTests()],
    ['Pedidos Status Update', getPedidosStatusUpdateTests()],
    ['Pedidos Status Rules', getPedidosStatusRulesTests()],
    ['Pedidos Audit', getPedidosAuditTests()],
    ['Pedidos Itens Update', getPedidosItensUpdateTests()],
    ['Pedidos Update', getPedidosUpdateTests()],
    ['Analytics Summary', getAnalyticsSummaryTests()],
    ['Analytics Products', getAnalyticsProductsTests()],
    ['Analytics Customers', getAnalyticsCustomersTests()],
    ['Analytics Periods', getAnalyticsPeriodsTests()],
    ['Analytics Tenant', getAnalyticsTenantTests()],
    ['Analytics Date Validation', getAnalyticsDateValidationTests()],
    ['Commercial Ownership', getCommercialOwnershipTests()],
    ['Interest Leads Create', getInterestLeadsCreateTests()],
    ['Interest Leads Validation', getInterestLeadsValidationTests()],
    ['Interest Leads List', getInterestLeadsListTests()],
    ['Interest Leads Status', getInterestLeadsStatusTests()],
    ['Interest Leads Export', getInterestLeadsExportTests()],
    ['Interest Leads Dashboard', getInterestLeadsDashboardTests()],
    ['Interest Leads Events', getInterestLeadsEventsTests()],
    ['Interest Leads Repository', getInterestLeadsRepositoryTests()],
    ['Interest Leads Invite', getInterestLeadsInviteTests()],
    ['Interest Leads Bulk Batch', getInterestLeadsBulkBatchTests()],
    ['Interest Leads Launch Dashboard', getInterestLeadsLaunchDashboardTests()],
    ['Interest Leads Convert', getInterestLeadsConvertTests()],
    ['Launch Templates', getLaunchTemplatesTests()],
    ['Launch Preview', getLaunchPreviewTests()],
    ['Launch Queue', getLaunchQueueTests()],
    ['Onboarding Start', getOnboardingStartTests()],
    ['Onboarding Step', getOnboardingStepTests()],
    ['Onboarding Complete', getOnboardingCompleteTests()],
    ['Account Activation Status', getAccountActivationStatusTests()],
    ['Implementation Status', getImplementationStatusTests()],
    ['Customer Success', getCustomerSuccessTests()],
    ['Customer Success Automation', getCustomerSuccessAutomationTests()],
    ['Customer Success Timeline', getCustomerSuccessTimelineTests()],
    ['Customer Memory', getCustomerMemoryTests()],
    ['WhatsApp Context', getWhatsappContextTests()],
    ['WhatsApp Conversations', getWhatsappConversationsTests()],
    ['WhatsApp Draft State', getWhatsappDraftStateTests()],
    ['Message Drafts', getMessageDraftsTests()],
    ['Action Aware Drafts', getActionAwareDraftsTests()],
    ['Message Approvals', getMessageApprovalsTests()],
    ['WhatsApp Delivery', getWhatsappDeliveryTests()],
    ['Commercial Agent', getCommercialAgentTests()],
    ['Approval Intelligence', getApprovalIntelligenceTests()],
    ['Portfolio Dashboard', getPortfolioDashboardTests()],
    ['Legacy Import', getLegacyImportTests()],
    ['Legacy Import Staging', getLegacyImportStagingTests()],
    ['Legacy Import Approval', getLegacyImportApprovalTests()],
    ['Legacy Import Promotion', getLegacyImportPromotionTests()],
    ['Jornada Comercial E2E', getJornadaComercialE2ETests()],
    ['Lead to Account Trial', getLeadToAccountTrialTests()],
    ['Billing Onboarding Integration', getBillingOnboardingIntegrationTests()],
    ['Executive Portfolio Analytics', getExecutivePortfolioAnalyticsTests()],
    ['Fabricantes', getFabricantesTests()],
    ['Product Audit', getProductAuditTests()],
    ['Product Editor', getProductEditorTests()]
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
