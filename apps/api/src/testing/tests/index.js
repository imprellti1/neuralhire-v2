import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTestSuite } from '../test-runner.js';

const PUBLIC_INTEREST_ACCOUNT_ID = 'acc-interest-public';
const SELF_URL = new URL(import.meta.url);
const SELF_PATH = fileURLToPath(SELF_URL);
const BATCH_SIZE = 1;

function bootstrapTestEnv() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.PUBLIC_INTEREST_ACCOUNT_ID = process.env.PUBLIC_INTEREST_ACCOUNT_ID || PUBLIC_INTEREST_ACCOUNT_ID;
}

bootstrapTestEnv();

const suiteSpecs = [
  ['Auth', './auth.test.js', 'getAuthTests'],
  ['RBAC', './rbac.test.js', 'getRbacTests'],
  ['Supabase Membership', './supabase-membership.test.js', 'getSupabaseMembershipTests'],
  ['Validation', './validation.test.js', 'getValidationTests'],
  ['Public Routes', './public-routes.test.js', 'getPublicRouteTests'],
  ['CORS', './cors.test.js', 'getCorsTests'],
  ['Payload Limit', './payload-limit.test.js', 'getPayloadLimitTests'],
  ['Scopes', './scopes.test.js', 'getScopesTests'],
  ['Clientes Repository', './clientes-repository.test.js', 'getClientesRepositoryTests'],
  ['Clientes Pagination', './clientes-pagination.test.js', 'getClientesPaginationTests'],
  ['Clientes Tenant', './clientes-tenant.test.js', 'getClientesTenantTests'],
  ['Clientes RLS Contract', './clientes-rls-contract.test.js', 'getClientesRlsContractTests'],
  ['Produtos Repository', './produtos-repository.test.js', 'getProdutosRepositoryTests'],
  ['Produtos Pagination', './produtos-pagination.test.js', 'getProdutosPaginationTests'],
  ['Produtos Tenant', './produtos-tenant.test.js', 'getProdutosTenantTests'],
  ['Produtos Search', './produtos-search.test.js', 'getProdutosSearchTests'],
  ['Produtos Variações', './produtos-variacoes.test.js', 'getProdutosVariacoesTests'],
  ['Produto Imagens', './produto-imagens.test.js', 'getProdutoImagensTests'],
  ['Pedidos Repository', './pedidos-repository.test.js', 'getPedidosRepositoryTests'],
  ['Pedidos Pagination', './pedidos-pagination.test.js', 'getPedidosPaginationTests'],
  ['Pedidos Tenant', './pedidos-tenant.test.js', 'getPedidosTenantTests'],
  ['Pedidos Create RBAC', './pedidos-create-rbac.test.js', 'getPedidosCreateRbacTests'],
  ['Pedidos Import', './pedidos-import.test.js', 'getPedidosImportTests'],
  ['Pedidos Itens Import', './pedidos-itens-import.test.js', 'getPedidosItensImportTests'],
  ['Clientes Commercial History', './clientes-commercial-history.test.js', 'getClientesCommercialHistoryTests'],
  ['Pedidos Calculation', './pedidos-calculation.test.js', 'getPedidosCalculationTests'],
  ['Pedidos Status', './pedidos-status.test.js', 'getPedidosStatusTests'],
  ['Pedidos Status Update', './pedidos-status-update.test.js', 'getPedidosStatusUpdateTests'],
  ['Pedidos Status Rules', './pedidos-status-rules.test.js', 'getPedidosStatusRulesTests'],
  ['Pedidos Audit', './pedidos-audit.test.js', 'getPedidosAuditTests'],
  ['Pedidos Vendedor', './pedidos-vendedor.test.js', 'getPedidosVendedorTests'],
  ['Pedidos Itens Update', './pedidos-itens-update.test.js', 'getPedidosItensUpdateTests'],
  ['Pedidos Update', './pedidos-update.test.js', 'getPedidosUpdateTests'],
  ['Analytics Summary', './analytics-summary.test.js', 'getAnalyticsSummaryTests'],
  ['Analytics Products', './analytics-products.test.js', 'getAnalyticsProductsTests'],
  ['Analytics Customers', './analytics-customers.test.js', 'getAnalyticsCustomersTests'],
  ['Analytics Periods', './analytics-periods.test.js', 'getAnalyticsPeriodsTests'],
  ['Analytics Tenant', './analytics-tenant.test.js', 'getAnalyticsTenantTests'],
  ['Analytics Date Validation', './analytics-date-validation.test.js', 'getAnalyticsDateValidationTests'],
  ['Commercial Ownership', './commercial-ownership.test.js', 'getCommercialOwnershipTests'],
  ['Interest Leads Create', './interest-leads-create.test.js', 'getInterestLeadsCreateTests'],
  ['Interest Leads Validation', './interest-leads-validation.test.js', 'getInterestLeadsValidationTests'],
  ['Interest Leads List', './interest-leads-list.test.js', 'getInterestLeadsListTests'],
  ['Interest Leads Status', './interest-leads-status.test.js', 'getInterestLeadsStatusTests'],
  ['Interest Leads Export', './interest-leads-export.test.js', 'getInterestLeadsExportTests'],
  ['Interest Leads Dashboard', './interest-leads-dashboard.test.js', 'getInterestLeadsDashboardTests'],
  ['Interest Leads Events', './interest-leads-events.test.js', 'getInterestLeadsEventsTests'],
  ['Interest Leads Repository', './interest-leads-repository.test.js', 'getInterestLeadsRepositoryTests'],
  ['Interest Leads Invite', './interest-leads-invite.test.js', 'getInterestLeadsInviteTests'],
  ['Interest Leads Bulk Batch', './interest-leads-bulk-batch.test.js', 'getInterestLeadsBulkBatchTests'],
  ['Interest Leads Launch Dashboard', './interest-leads-launch-dashboard.test.js', 'getInterestLeadsLaunchDashboardTests'],
  ['Interest Leads Convert', './interest-leads-convert.test.js', 'getInterestLeadsConvertTests'],
  ['Launch Templates', './launch-templates.test.js', 'getLaunchTemplatesTests'],
  ['Launch Preview', './launch-preview.test.js', 'getLaunchPreviewTests'],
  ['Launch Queue', './launch-queue.test.js', 'getLaunchQueueTests'],
  ['Onboarding Start', './onboarding-start.test.js', 'getOnboardingStartTests'],
  ['Onboarding Step', './onboarding-step.test.js', 'getOnboardingStepTests'],
  ['Onboarding Complete', './onboarding-complete.test.js', 'getOnboardingCompleteTests'],
  ['Account Activation Status', './account-activation-status.test.js', 'getAccountActivationStatusTests'],
  ['Implementation Status', './implementation-status.test.js', 'getImplementationStatusTests'],
  ['Customer Success', './customer-success.test.js', 'getCustomerSuccessTests'],
  ['Customer Success Automation', './customer-success-automation.test.js', 'getCustomerSuccessAutomationTests'],
  ['Customer Success Timeline', './customer-success-timeline.test.js', 'getCustomerSuccessTimelineTests'],
  ['Customer Memory', './customer-memory.test.js', 'getCustomerMemoryTests'],
  ['WhatsApp Context', './whatsapp-context.test.js', 'getWhatsappContextTests'],
  ['WhatsApp Conversations', './whatsapp-conversations.test.js', 'getWhatsappConversationsTests'],
  ['WhatsApp Draft State', './whatsapp-draft-state.test.js', 'getWhatsappDraftStateTests'],
  ['Message Drafts', './message-drafts.test.js', 'getMessageDraftsTests'],
  ['Action Aware Drafts', './action-aware-drafts.test.js', 'getActionAwareDraftsTests'],
  ['Message Approvals', './message-approvals.test.js', 'getMessageApprovalsTests'],
  ['WhatsApp Delivery', './whatsapp-delivery.test.js', 'getWhatsappDeliveryTests'],
  ['Commercial Agent', './commercial-agent.test.js', 'getCommercialAgentTests'],
  ['Approval Intelligence', './approval-intelligence.test.js', 'getApprovalIntelligenceTests'],
  ['Portfolio Dashboard', './portfolio-dashboard.test.js', 'getPortfolioDashboardTests'],
  ['Legacy Import', './legacy-import.test.js', 'getLegacyImportTests'],
  ['Clientes Import', './clientes-import.test.js', 'getClientesImportTests'],
  ['Legacy Import Staging', './legacy-import-staging.test.js', 'getLegacyImportStagingTests'],
  ['Legacy Import Approval', './legacy-import-approval.test.js', 'getLegacyImportApprovalTests'],
  ['Legacy Import Promotion', './legacy-import-promotion.test.js', 'getLegacyImportPromotionTests'],
  ['Jornada Comercial E2E', './jornada-comercial-e2e.test.js', 'getJornadaComercialE2ETests'],
  ['Lead to Account Trial', './lead-to-account-trial.test.js', 'getLeadToAccountTrialTests'],
  ['Billing Onboarding Integration', './billing-onboarding-integration.test.js', 'getBillingOnboardingIntegrationTests'],
  ['Executive Portfolio Analytics', './executive-portfolio-analytics.test.js', 'getExecutivePortfolioAnalyticsTests'],
  ['Fabricantes', './fabricantes.test.js', 'getFabricantesTests'],
  ['Fabricantes Tenant', './fabricantes-tenant.test.js', 'getFabricantesTenantTests'],
  ['Product Audit', './product-audit.test.js', 'getProductAuditTests'],
  ['Produto Categorias', './produto-categorias.test.js', 'getProdutoCategoriasTests'],
  ['Produtos Import', './produtos-import.test.js', 'getProdutosImportTests'],
  ['Product Editor', './product-editor.test.js', 'getProductEditorTests'],
  ['IA Memorias', '../../modules/ia-memorias/ia-memorias.test.js', 'getIaMemoriasTests'],
  ['Ai Director', './ai-director.test.js', 'getAiDirectorTests'],
  ['Ai Director Repository', '../../modules/ai-director/ai-director.repository.test.js', 'getAiDirectorRepositoryTests'],
  ['Ai Director Controller', '../../modules/ai-director/ai-director.controller.test.js', 'getAiDirectorControllerTests'],
  ['Vendedores', './vendedores.test.js', 'getVendedoresTests'],
  ['Clientes Vendedor Scope', './clientes-vendedor-scope.test.js', 'getClientesVendedorScopeTests'],
  ['Audit Logs', './audit-logs.test.js', 'getAuditLogsTests'],
  ['Promocoes', './promocoes.test.js', 'getPromocoesTests']
];

function chunkSpecs(specs, size) {
  const chunks = [];
  for (let i = 0; i < specs.length; i += size) chunks.push(specs.slice(i, i + size));
  return chunks;
}

async function loadSuites(specs) {
  const suites = [];
  for (const [name, relativePath, exportName] of specs) {
    const moduleUrl = new URL(relativePath, import.meta.url);
    const mod = await import(moduleUrl);
    const getter = mod?.[exportName];
    const tests = typeof getter === 'function' ? getter() : [];
    suites.push([name, tests]);
  }
  return suites;
}

async function runBatch(batchIndex = 0) {
  const selected = [suiteSpecs[batchIndex]].filter(Boolean);
  const suites = await loadSuites(selected);
  const summary = { total: 0, passed: 0, failed: 0 };
  for (const [name, tests] of suites) {
    const result = await runTestSuite(name, tests);
    summary.total += result.total;
    summary.passed += result.passed;
    summary.failed += result.failed;
  }
  return summary;
}

async function main() {
  const mode = process.env.TEST_API_BATCH_MODE || 'orchestrator';
  const batchIndex = Number(process.env.TEST_API_BATCH_INDEX || 0);
  if (mode === 'batch') {
    const summary = await runBatch(batchIndex);
    console.log('\n=== API Test Summary ===');
    console.log(`Batch: ${batchIndex + 1}`);
    console.log(`Total: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    if (summary.failed > 0) process.exitCode = 1;
    return;
  }

  const batches = chunkSpecs(suiteSpecs, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const result = spawnSync(process.execPath, ['--max-old-space-size=8192', SELF_PATH], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_API_BATCH_MODE: 'batch',
        TEST_API_BATCH_INDEX: String(i)
      }
    });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      return;
    }
  }
}

main();
