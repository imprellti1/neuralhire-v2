import { createApiClient } from './core/api-client.js';
import { renderAnalyticsDashboardPage } from './modules/analytics-dashboard/dashboard.page.js';
import { renderClientesPage } from './modules/clientes-crm/clientes.page.js';
import { renderClienteDetailsPage } from './modules/clientes-crm/cliente-details.page.js';
import { renderClienteCreatePage } from './modules/clientes-crm/cliente-create.page.js';
import { renderInterestLeadsPage } from './modules/interest-leads/interest-leads.page.js';
import { renderInterestLeadDetailsPage } from './modules/interest-leads-details/interest-lead-details.page.js';
import { renderInterestLeadsDashboardPage } from './modules/interest-leads-dashboard/interest-leads-dashboard.page.js';
import { renderInterestLeadsLaunchPage } from './modules/interest-leads-launch/interest-leads-launch.page.js';
import { renderLaunchTemplatesPage } from './modules/launch-templates/launch-templates.page.js';
import { renderOnboardingPage } from './modules/onboarding/onboarding.page.js';
import { renderActivationPage } from './modules/account-activation/activation.page.js';
import { renderOperationalDashboardPage } from './modules/operational-dashboard/operational-dashboard.page.js';
import { renderPedidoDetailsPage } from './modules/pedidos-comercial/pedido-details.page.js';
import { renderPedidosPage } from './modules/pedidos-comercial/pedidos.page.js';
import { renderPedidoCreatePage } from './modules/pedidos-comercial/pedido-create.page.js';
import { renderProdutosPage } from './modules/produtos-catalogo/produtos.page.js';
import { renderProdutoCreatePage } from './modules/produtos-catalogo/produto-create.page.js';
import { renderProdutoDetailsPage } from './modules/produtos-catalogo/produto-details.page.js';
import { renderPublicLandingPage } from './modules/public-site/landing.page.js';
import { renderBillingPage } from './modules/billing/billing.page.js';
import { renderImplementationPage } from './modules/implementation-tracker/implementation.page.js';
import { renderCustomerSuccessPage } from './modules/customer-success/customer-success.page.js';
import { renderAutomationPage } from './modules/customer-success-automation/automation.page.js';
import { renderTimelinePage } from './modules/customer-success-timeline/timeline.page.js';
import { renderRetentionPage } from './modules/customer-retention/retention.page.js';
import { renderCustomerMemoryPage } from './modules/customer-memory/customer-memory.page.js';
import { renderExecutiveDashboardPage } from './modules/executive-dashboard/executive-dashboard.page.js';
import { renderExecutivePortfolioAnalyticsPage } from './modules/executive-portfolio-analytics/executive-portfolio-analytics.page.js';
import { renderRevenuePage } from './modules/revenue-intelligence/revenue.page.js';
import { renderPortfolioDashboardPage } from './modules/portfolio-dashboard/portfolio-dashboard.page.js';
import { renderLegacyImportPage } from './modules/legacy-import/legacy-import.page.js';
import { renderWhatsappConversationsPage } from './modules/whatsapp-conversations/whatsapp-conversations.page.js';
import { renderMessageApprovalsPage } from './modules/message-approvals/message-approvals.page.js';
import { renderApprovalIntelligencePage } from './modules/approval-intelligence/approval-intelligence.page.js';
import { renderFabricantesPage } from './modules/fabricantes/fabricantes.page.js';
import { renderProductAuditPage } from './modules/product-audit/product-audit.page.js';
import { renderProductEditorPage } from './modules/product-editor/product-editor.page.js';
import { renderLoginPage } from './modules/auth/login.page.js';
import { hasAuthSession, clearAuthSession } from './core/auth-session.js';

function injectAppStyles() {
  if (document.getElementById('nh-app-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-app-style';
  style.textContent = `:root{--bg:#f4f7fc;--bg-soft:#eef3fb;--panel:#ffffff;--text:#12203a;--muted:#61708f;--line:#dbe4f2;--brand:#2563eb;--brand-soft:#dbe7ff;--ok:#047857;--warn:#b45309;--danger:#b42318;--shadow:0 14px 34px rgba(15,35,74,.08)}*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;color:var(--text);background:radial-gradient(1000px 500px at 90% -20%,#dbe8ff 0%,rgba(219,232,255,0) 70%),linear-gradient(180deg,#f8fbff 0%,var(--bg) 100%)}.nh-shell{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}.nh-sidebar{padding:24px 18px;border-right:1px solid var(--line);background:rgba(255,255,255,.8);backdrop-filter:blur(8px)}.nh-brand{padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#1948bf,#2563eb);color:#fff;font-weight:700;letter-spacing:.02em;box-shadow:var(--shadow)}.nh-brand small{display:block;font-weight:500;opacity:.85;margin-top:4px}.nh-nav{margin-top:18px;display:grid;gap:8px}.nh-menu-item{display:block;padding:12px 14px;border-radius:12px;color:#20304f;text-decoration:none;font-weight:600;transition:.2s background,.2s color,.2s transform}.nh-menu-item:hover{background:#edf3ff;transform:translateY(-1px)}.nh-menu-item.is-active{background:var(--brand-soft);color:#0f3da8;box-shadow:inset 0 0 0 1px #c8dafd}.nh-main{padding:0 24px 28px;min-width:0}.nh-content{max-width:1360px;width:100%;margin:0 auto;padding-top:24px}@media (max-width:1280px){.nh-shell{grid-template-columns:220px minmax(0,1fr)}.nh-main{padding:0 20px 24px}.nh-content{padding-top:20px}}@media (max-width:1024px){.nh-shell{grid-template-columns:1fr}.nh-sidebar{display:none}.nh-main{padding:0 12px 20px}.nh-content{padding-top:12px}}`;
  document.head.appendChild(style);
}

function createLayout() {
  const root = document.createElement('div');
  root.className = 'nh-shell';
  root.innerHTML = `<aside class="nh-sidebar"><div class="nh-brand">NeuralHire v2<small>Cockpit Executivo</small></div><nav class="nh-nav"><div style="font-size:11px;color:#71809b;text-transform:uppercase;letter-spacing:.06em;padding:6px 10px 2px">Comercial</div><a class="nh-menu-item" data-route="#/dashboard-comercial" href="#/dashboard-comercial">Dashboard Comercial</a><a class="nh-menu-item" data-route="#/clientes" href="#/clientes">Clientes CRM</a><a class="nh-menu-item" data-route="#/fabricantes" href="#/fabricantes">Fábricas</a><a class="nh-menu-item" data-route="#/product-audit" href="#/product-audit">Auditoria de Produtos</a><a class="nh-menu-item" data-route="#/produtos" href="#/produtos">Produtos</a><a class="nh-menu-item" data-route="#/product-editor" href="#/product-editor">Editor de Produtos</a><a class="nh-menu-item" data-route="#/pedidos" href="#/pedidos">Pedidos</a><a class="nh-menu-item" data-route="#/interest-leads" href="#/interest-leads">Lista de Interesse</a><a class="nh-menu-item" data-route="#/launch/templates" href="#/launch/templates">Templates Lancamento</a><a class="nh-menu-item" data-route="#/onboarding" href="#/onboarding">Onboarding</a><a class="nh-menu-item" data-route="#/activation" href="#/activation">Ativacao Inicial</a><a class="nh-menu-item" data-route="#/implementation" href="#/implementation">Acompanhamento</a><a class="nh-menu-item" data-route="#/customer-success" href="#/customer-success">Customer Success</a><a class="nh-menu-item" data-route="#/customer-success-automation" href="#/customer-success-automation">Automações CS</a><a class="nh-menu-item" data-route="#/customer-success-timeline" href="#/customer-success-timeline">Timeline CS</a><a class="nh-menu-item" data-route="#/customer-retention" href="#/customer-retention">Renovacoes & Expansao</a><a class="nh-menu-item" data-route="#/customer-memory/cliente-demo" href="#/customer-memory/cliente-demo">Customer Memory</a><a class="nh-menu-item" data-route="#/whatsapp-conversations" href="#/whatsapp-conversations">WhatsApp</a><a class="nh-menu-item" data-route="#/message-approvals" href="#/message-approvals">Aprovação Humana</a><a class="nh-menu-item" data-route="#/approval-intelligence" href="#/approval-intelligence">Inteligência Comercial</a><div style="font-size:11px;color:#71809b;text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 2px">Operação</div><a class="nh-menu-item" data-route="#/dashboard-operacional" href="#/dashboard-operacional">Dashboard Operacional</a><a class="nh-menu-item" data-route="#/executive-dashboard" href="#/executive-dashboard">Executive Dashboard</a><a class="nh-menu-item" data-route="#/executive-portfolio-analytics" href="#/executive-portfolio-analytics">Executive Analytics</a><a class="nh-menu-item" data-route="#/revenue-intelligence" href="#/revenue-intelligence">Revenue Intelligence</a><a class="nh-menu-item" data-route="#/portfolio-dashboard" href="#/portfolio-dashboard">Portfolio Dashboard</a><a class="nh-menu-item" data-route="#/legacy-import" href="#/legacy-import">Importacao Legado</a><a class="nh-menu-item" data-route="#/login" href="#/login">Login Supabase</a><a class="nh-menu-item" data-route="#/logout" href="#/logout">Logout</a></nav></aside><main class="nh-main"><section class="nh-content" id="app-content"></section></main>`;
  return root;
}

function setActiveMenu(route) {
  document.querySelectorAll('.nh-menu-item').forEach((el) => {
    el.classList.toggle('is-active', el.getAttribute('data-route') === route);
  });
}

export function bootstrapWebApp() {
  if (typeof document === 'undefined') return;
  injectAppStyles();
  const api = createApiClient();
  const appEnv = String(window.__NEURALHIRE_CONFIG__?.VITE_APP_ENV || import.meta.env?.VITE_APP_ENV || '').toLowerCase();
  const hasDemoConfig = Boolean(window.__NEURALHIRE_CONFIG__?.VITE_DEMO_ACCOUNT_ID);
  const requiresLogin = (appEnv === 'homologation' || appEnv === 'production') && !hasDemoConfig;
  const renderRoute = () => {
    const route = window.location.hash || '#/';
    if (route === '#/logout') {
      clearAuthSession();
      window.location.hash = '#/login';
      return;
    }
    if (route === '#/' || route === '#') {
      document.body.innerHTML = '';
      renderPublicLandingPage(document.body, { apiClient: api });
      return;
    }

    let layout = document.querySelector('.nh-shell');
    if (!layout) {
      layout = createLayout();
      document.body.innerHTML = '';
      document.body.appendChild(layout);
    }

    const content = document.getElementById('app-content');
  const activeRoute = route.startsWith('#/pedidos/') ? '#/pedidos'
      : route.startsWith('#/clientes/') ? '#/clientes'
    : route.startsWith('#/fabricantes/') ? '#/fabricantes'
    : route.startsWith('#/product-audit/') ? '#/product-audit'
      : route.startsWith('#/interest-leads/') ? '#/interest-leads'
      : route.startsWith('#/customer-memory/') ? '#/customer-memory/cliente-demo'
      : route;
    setActiveMenu(activeRoute);

    if (route === '#/login') return renderLoginPage(content);
    if (requiresLogin && !hasAuthSession() && route !== '#/login') {
      window.location.hash = '#/login';
      return;
    }
    if (route === '#/clientes') return renderClientesPage(content, { apiClient: api });
    if (route === '#/clientes/novo') return renderClienteCreatePage(content, { apiClient: api });
    if (route.startsWith('#/clientes/')) return renderClienteDetailsPage(content, { apiClient: api, clienteId: route.slice('#/clientes/'.length).split('?')[0] });
    if (route === '#/produtos') return renderProdutosPage(content, { apiClient: api });
    if (route === '#/product-editor') return renderProductEditorPage(content, { apiClient: api });
    if (route === '#/produtos/novo') return renderProdutoCreatePage(content, { apiClient: api });
    if (route.startsWith('#/produtos/')) return renderProdutoDetailsPage(content, { apiClient: api, produtoId: route.slice('#/produtos/'.length).split('?')[0] });
    if (route === '#/pedidos') return renderPedidosPage(content, { apiClient: api });
    if (route === '#/pedidos/novo') return renderPedidoCreatePage(content, { apiClient: api });
    if (route.startsWith('#/pedidos/')) return renderPedidoDetailsPage(content, { apiClient: api, pedidoId: route.slice('#/pedidos/'.length).split('?')[0] });
    if (route === '#/interest-leads') return renderInterestLeadsPage(content, { apiClient: api });
    if (route === '#/interest-leads/dashboard') return renderInterestLeadsDashboardPage(content, { apiClient: api });
    if (route === '#/interest-leads/launch') return renderInterestLeadsLaunchPage(content, { apiClient: api });
    if (route === '#/launch/templates') return renderLaunchTemplatesPage(content, { apiClient: api });
    if (route === '#/onboarding') return renderOnboardingPage(content, { apiClient: api });
    if (route === '#/activation') return renderActivationPage(content, { apiClient: api });
    if (route === '#/billing') return renderBillingPage(content, { apiClient: api });
    if (route === '#/implementation') return renderImplementationPage(content, { apiClient: api });
    if (route === '#/customer-success') return renderCustomerSuccessPage(content, { apiClient: api });
    if (route === '#/customer-success-automation') return renderAutomationPage(content, { apiClient: api });
    if (route === '#/customer-success-timeline') return renderTimelinePage(content, { apiClient: api });
    if (route === '#/customer-retention') return renderRetentionPage(content, { apiClient: api });
    if (route.startsWith('#/customer-memory/')) return renderCustomerMemoryPage(content, { apiClient: api, clienteId: route.slice('#/customer-memory/'.length).split('?')[0] });
    if (route === '#/whatsapp-conversations') return renderWhatsappConversationsPage(content, { apiClient: api });
    if (route === '#/message-approvals') return renderMessageApprovalsPage(content, { apiClient: api });
    if (route === '#/approval-intelligence') return renderApprovalIntelligencePage(content, { apiClient: api });
    if (route === '#/fabricantes') return renderFabricantesPage(content, { apiClient: api });
    if (route.startsWith('#/fabricantes/')) return renderFabricantesPage(content, { apiClient: api, fabricanteId: route.slice('#/fabricantes/'.length).split('?')[0] });
    if (route === '#/product-audit') return renderProductAuditPage(content, { apiClient: api });
    if (route === '#/executive-dashboard') return renderExecutiveDashboardPage(content, { apiClient: api });
    if (route === '#/executive-portfolio-analytics') return renderExecutivePortfolioAnalyticsPage(content, { apiClient: api });
    if (route === '#/revenue-intelligence') return renderRevenuePage(content, { apiClient: api });
    if (route === '#/portfolio-dashboard') return renderPortfolioDashboardPage(content, { apiClient: api });
    if (route === '#/legacy-import') return renderLegacyImportPage(content, { apiClient: api });
    if (route.startsWith('#/interest-leads/')) return renderInterestLeadDetailsPage(content, { apiClient: api, leadId: route.slice('#/interest-leads/'.length).split('?')[0] });
    if (route === '#/dashboard-operacional') return renderOperationalDashboardPage(content, { apiClient: api });
    return renderAnalyticsDashboardPage(content, { apiClient: api });
  };

  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
