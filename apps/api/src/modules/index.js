import { defineModule } from '../core/module-contract.js';
import { registerHealthRoutes } from './health/health.routes.js';
import { registerSystemRoutes } from './system/system.routes.js';
import { registerClientesRoutes } from './clientes/clientes.routes.js';
import { clientesModule } from './clientes/clientes.module.js';
import { registerProdutosRoutes } from './produtos/produtos.routes.js';
import { registerProdutosImportRoutes } from './produtos/produtos-import.routes.js';
import { produtosModule } from './produtos/produtos.module.js';
import { registerPriceTableImportRoutes } from './price-table-import/price-table-import.routes.js';
import { priceTableImportModule } from './price-table-import/price-table-import.module.js';
import { registerClientesImportRoutes } from './clientes-import/clientes-import.routes.js';
import { clientesImportModule } from './clientes-import/clientes-import.module.js';
import { registerProdutoCategoriasRoutes } from './produto-categorias/produto-categorias.routes.js';
import { produtoCategoriasModule } from './produto-categorias/produto-categorias.module.js';
import { registerPedidosRoutes } from './pedidos/pedidos.routes.js';
import { pedidosModule } from './pedidos/pedidos.module.js';
import { registerPedidosImportRoutes } from './pedidos-import/pedidos-import.routes.js';
import { pedidosImportModule } from './pedidos-import/pedidos-import.module.js';
import { registerPedidosItensRoutes } from './pedidos-itens/pedidos-itens.routes.js';
import { pedidosItensModule } from './pedidos-itens/pedidos-itens.module.js';
import { registerAnalyticsRoutes } from './analytics/analytics.routes.js';
import { analyticsModule } from './analytics/analytics.module.js';
import { registerInterestLeadsRoutes } from './interest-leads/interest-leads.routes.js';
import { interestLeadsModule } from './interest-leads/interest-leads.module.js';
import { registerBillingRoutes } from './billing/billing.routes.js';
import { billingModule } from './billing/billing.module.js';
import { registerOnboardingRoutes } from './onboarding/onboarding.routes.js';
import { onboardingModule } from './onboarding/onboarding.module.js';
import { registerAccountActivationRoutes } from './account-activation/account-activation.routes.js';
import { accountActivationModule } from './account-activation/account-activation.module.js';
import { registerImplementationTrackerRoutes } from './implementation-tracker/implementation-tracker.routes.js';
import { implementationTrackerModule } from './implementation-tracker/implementation-tracker.module.js';
import { registerCustomerSuccessRoutes } from './customer-success/customer-success.routes.js';
import { customerSuccessModule } from './customer-success/customer-success.module.js';
import { registerCustomerSuccessAutomationRoutes } from './customer-success-automation/customer-success-automation.routes.js';
import { customerSuccessAutomationModule } from './customer-success-automation/customer-success-automation.module.js';
import { registerCustomerSuccessTimelineRoutes } from './customer-success-timeline/customer-success-timeline.routes.js';
import { customerSuccessTimelineModule } from './customer-success-timeline/customer-success-timeline.module.js';
import { registerCustomerRetentionRoutes } from './customer-retention/customer-retention.routes.js';
import { customerRetentionModule } from './customer-retention/customer-retention.module.js';
import { registerCustomerMemoryRoutes } from './customer-memory/customer-memory.routes.js';
import { customerMemoryModule } from './customer-memory/customer-memory.module.js';
import { registerExecutiveDashboardRoutes } from './executive-dashboard/executive-dashboard.routes.js';
import { executiveDashboardModule } from './executive-dashboard/executive-dashboard.module.js';
import { registerExecutivePortfolioAnalyticsRoutes } from './executive-portfolio-analytics/executive-portfolio-analytics.routes.js';
import { executivePortfolioAnalyticsModule } from './executive-portfolio-analytics/executive-portfolio-analytics.module.js';
import { registerRevenueIntelligenceRoutes } from './revenue-intelligence/revenue-intelligence.routes.js';
import { revenueIntelligenceModule } from './revenue-intelligence/revenue-intelligence.module.js';
import { registerPortfolioDashboardRoutes } from './portfolio-dashboard/portfolio-dashboard.routes.js';
import { portfolioDashboardModule } from './portfolio-dashboard/portfolio-dashboard.module.js';
import { registerLegacyImportRoutes } from './legacy-import/legacy-import.routes.js';
import { legacyImportModule } from './legacy-import/legacy-import.module.js';
import { registerWhatsappConversationsRoutes } from './whatsapp-conversations/whatsapp-conversations.routes.js';
import { whatsappConversationsModule } from './whatsapp-conversations/whatsapp-conversations.module.js';
import { registerMessageDraftRoutes } from './message-drafts/message-drafts.routes.js';
import { messageDraftsModule } from './message-drafts/message-drafts.module.js';
import { registerMessageApprovalsRoutes } from './message-approvals/message-approvals.routes.js';
import { messageApprovalsModule } from './message-approvals/message-approvals.module.js';
import { registerApprovalIntelligenceRoutes } from './approval-intelligence/approval-intelligence.routes.js';
import { approvalIntelligenceModule } from './approval-intelligence/approval-intelligence.module.js';
import { registerWhatsappDeliveryRoutes } from './whatsapp-delivery/whatsapp-delivery.routes.js';
import { whatsappDeliveryModule } from './whatsapp-delivery/whatsapp-delivery.module.js';
import { registerCommercialAgentRoutes } from './commercial-agent/commercial-agent.routes.js';
import { commercialAgentModule } from './commercial-agent/commercial-agent.module.js';
import { registerFabricantesRoutes } from './fabricantes/fabricantes.routes.js';
import { fabricantesModule } from './fabricantes/fabricantes.module.js';
import { registerVendedoresRoutes } from './vendedores/vendedores.routes.js';
import { vendedoresModule } from './vendedores/vendedores.module.js';
import { registerProductAuditRoutes } from './product-audit/product-audit.routes.js';
import { productAuditModule } from './product-audit/product-audit.module.js';
import { registerProductEditorRoutes } from './product-editor/product-editor.routes.js';
import { productEditorModule } from './product-editor/product-editor.module.js';
import { registerProdutoImagensRoutes } from './produto-imagens/produto-imagens.routes.js';
import { produtoImagensModule } from './produto-imagens/produto-imagens.module.js';
import { registerAuditLogsRoutes } from './audit-logs/audit-logs.routes.js';
import { auditLogsModule } from './audit-logs/audit-logs.module.js';
import { registerPromocoesRoutes } from './promocoes/promocoes.routes.js';
import { promocoesModule } from './promocoes/promocoes.module.js';
import { registerAiDirectorRoutes } from './ai-director/ai-director.routes.js';
import { aiDirectorModule } from './ai-director/ai-director.module.js';

export const registeredModules = [
  defineModule({ name: 'health', domain: 'core-platform', routes: ['GET /health'] }),
  defineModule({ name: 'system', domain: 'core-platform', routes: ['GET /system/info', 'GET /system/auth-context', 'GET /system/protected', 'GET /system/admin-only', 'POST /system/echo'] }),
  clientesModule, produtosModule, produtoCategoriasModule, pedidosModule, analyticsModule, interestLeadsModule, billingModule, onboardingModule,
  accountActivationModule, implementationTrackerModule, customerSuccessModule, customerSuccessAutomationModule,
  customerSuccessTimelineModule, customerRetentionModule, executiveDashboardModule, executivePortfolioAnalyticsModule,
  revenueIntelligenceModule, portfolioDashboardModule, legacyImportModule, customerMemoryModule,
  whatsappConversationsModule, messageDraftsModule, messageApprovalsModule, approvalIntelligenceModule, whatsappDeliveryModule, commercialAgentModule, fabricantesModule, vendedoresModule,
  priceTableImportModule, clientesImportModule
  ,pedidosImportModule, pedidosItensModule, productAuditModule, productEditorModule, produtoImagensModule, auditLogsModule
  ,promocoesModule, aiDirectorModule
];

export function registerModules(router, options = {}) {
  registerHealthRoutes(router); registerSystemRoutes(router, { registeredModules, globalMiddlewares: options.globalMiddlewares || [] });
  registerClientesRoutes(router); registerProdutosRoutes(router); registerProdutosImportRoutes(router); registerPedidosRoutes(router); registerAnalyticsRoutes(router);
  registerPriceTableImportRoutes(router);
  registerClientesImportRoutes(router);
  registerPedidosImportRoutes(router);
  registerPedidosItensRoutes(router);
  registerProdutoCategoriasRoutes(router);
  registerInterestLeadsRoutes(router); registerBillingRoutes(router); registerOnboardingRoutes(router); registerAccountActivationRoutes(router);
  registerImplementationTrackerRoutes(router); registerCustomerSuccessRoutes(router); registerCustomerSuccessAutomationRoutes(router);
  registerCustomerSuccessTimelineRoutes(router); registerCustomerRetentionRoutes(router); registerCustomerMemoryRoutes(router); registerExecutiveDashboardRoutes(router);
  registerExecutivePortfolioAnalyticsRoutes(router); registerRevenueIntelligenceRoutes(router); registerPortfolioDashboardRoutes(router); registerLegacyImportRoutes(router);
  registerWhatsappConversationsRoutes(router); registerMessageDraftRoutes(router);
  registerMessageApprovalsRoutes(router);
  registerApprovalIntelligenceRoutes(router);
  registerWhatsappDeliveryRoutes(router);
  registerCommercialAgentRoutes(router);
  registerFabricantesRoutes(router);
  registerVendedoresRoutes(router);
  registerProductAuditRoutes(router);
  registerProductEditorRoutes(router);
  registerProdutoImagensRoutes(router);
  registerAuditLogsRoutes(router);
  registerPromocoesRoutes(router);
  registerAiDirectorRoutes(router);
}


