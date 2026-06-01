import { createApiClient } from './core/api-client.js';
import { renderAnalyticsDashboardPage } from './modules/analytics-dashboard/dashboard.page.js';
import { renderClientesPage } from './modules/clientes-crm/clientes.page.js';
import { renderClienteDetailsPage } from './modules/clientes-crm/cliente-details.page.js';
import { renderClienteCreatePage } from './modules/clientes-crm/cliente-create.page.js';
import { renderOperationalDashboardPage } from './modules/operational-dashboard/operational-dashboard.page.js';
import { renderPedidoDetailsPage } from './modules/pedidos-comercial/pedido-details.page.js';
import { renderPedidosPage } from './modules/pedidos-comercial/pedidos.page.js';
import { renderPedidoCreatePage } from './modules/pedidos-comercial/pedido-create.page.js';
import { renderProdutosPage } from './modules/produtos-catalogo/produtos.page.js';
import { renderProdutoCreatePage } from './modules/produtos-catalogo/produto-create.page.js';
import { renderProdutoDetailsPage } from './modules/produtos-catalogo/produto-details.page.js';

function injectAppStyles() {
  if (document.getElementById('nh-app-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-app-style';
  style.textContent = `
  :root{--bg:#f4f7fc;--bg-soft:#eef3fb;--panel:#ffffff;--text:#12203a;--muted:#61708f;--line:#dbe4f2;--brand:#2563eb;--brand-soft:#dbe7ff;--ok:#047857;--warn:#b45309;--danger:#b42318;--shadow:0 14px 34px rgba(15,35,74,.08)}
  *{box-sizing:border-box}
  body{margin:0;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;color:var(--text);background:radial-gradient(1000px 500px at 90% -20%,#dbe8ff 0%,rgba(219,232,255,0) 70%),linear-gradient(180deg,#f8fbff 0%,var(--bg) 100%)}
  .nh-shell{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}
  .nh-sidebar{padding:24px 18px;border-right:1px solid var(--line);background:rgba(255,255,255,.8);backdrop-filter:blur(8px)}
  .nh-brand{padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#1948bf,#2563eb);color:#fff;font-weight:700;letter-spacing:.02em;box-shadow:var(--shadow)}
  .nh-brand small{display:block;font-weight:500;opacity:.85;margin-top:4px}
  .nh-nav{margin-top:18px;display:grid;gap:8px}
  .nh-menu-item{display:block;padding:12px 14px;border-radius:12px;color:#20304f;text-decoration:none;font-weight:600;transition:.2s background,.2s color,.2s transform}
  .nh-menu-item:hover{background:#edf3ff;transform:translateY(-1px)}
  .nh-menu-item.is-active{background:var(--brand-soft);color:#0f3da8;box-shadow:inset 0 0 0 1px #c8dafd}
  .nh-main{padding:0 24px 28px;min-width:0}
  .nh-content{max-width:1360px;width:100%;margin:0 auto;padding-top:24px}
  @media (max-width:1280px){.nh-shell{grid-template-columns:220px minmax(0,1fr)}.nh-main{padding:0 20px 24px}.nh-content{padding-top:20px}}
  @media (max-width:1024px){.nh-shell{grid-template-columns:1fr}.nh-sidebar{display:none}.nh-main{padding:0 12px 20px}.nh-content{padding-top:12px}}
  `;
  document.head.appendChild(style);
}

function createLayout() {
  const root = document.createElement('div');
  root.className = 'nh-shell';
  root.innerHTML = `
    <aside class="nh-sidebar">
      <div class="nh-brand">NeuralHire v2<small>Cockpit Executivo</small></div>
      <nav class="nh-nav">
        <div style="font-size:11px;color:#71809b;text-transform:uppercase;letter-spacing:.06em;padding:6px 10px 2px">Comercial</div>
        <a class="nh-menu-item" data-route="#/dashboard-comercial" href="#/dashboard-comercial">Dashboard Comercial</a>
        <a class="nh-menu-item" data-route="#/clientes" href="#/clientes">Clientes CRM</a>
        <a class="nh-menu-item" data-route="#/produtos" href="#/produtos">Produtos</a>
        <a class="nh-menu-item" data-route="#/pedidos" href="#/pedidos">Pedidos</a>
        <div style="font-size:11px;color:#71809b;text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 2px">Operação</div>
        <a class="nh-menu-item" data-route="#/dashboard-operacional" href="#/dashboard-operacional">Dashboard Operacional</a>
      </nav>
    </aside>
    <main class="nh-main"><section class="nh-content" id="app-content"></section></main>
  `;
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
  const layout = createLayout();
  document.body.innerHTML = '';
  document.body.appendChild(layout);
  const content = document.getElementById('app-content');

  const renderRoute = () => {
    const route = window.location.hash || '#/dashboard-comercial';
    setActiveMenu(route.startsWith('#/pedidos/') ? '#/pedidos' : (route.startsWith('#/clientes/') ? '#/clientes' : route));
    if (route === '#/clientes') {
      renderClientesPage(content, { apiClient: api });
      return;
    }
    if (route === '#/clientes/novo') {
      renderClienteCreatePage(content, { apiClient: api });
      return;
    }
    if (route.startsWith('#/clientes/')) {
      const clienteId = route.slice('#/clientes/'.length).split('?')[0];
      renderClienteDetailsPage(content, { apiClient: api, clienteId });
      return;
    }
    if (route === '#/produtos') {
      renderProdutosPage(content, { apiClient: api });
      return;
    }
    if (route === '#/produtos/novo') {
      renderProdutoCreatePage(content, { apiClient: api });
      return;
    }
    if (route.startsWith('#/produtos/')) {
      const produtoId = route.slice('#/produtos/'.length).split('?')[0];
      renderProdutoDetailsPage(content, { apiClient: api, produtoId });
      return;
    }
    if (route === '#/pedidos') {
      renderPedidosPage(content, { apiClient: api });
      return;
    }
    if (route === '#/pedidos/novo') {
      renderPedidoCreatePage(content, { apiClient: api });
      return;
    }
    if (route.startsWith('#/pedidos/')) {
      const pedidoId = route.slice('#/pedidos/'.length).split('?')[0];
      renderPedidoDetailsPage(content, { apiClient: api, pedidoId });
      return;
    }
    if (route === '#/dashboard-operacional') {
      renderOperationalDashboardPage(content, { apiClient: api });
      return;
    }
    renderAnalyticsDashboardPage(content, { apiClient: api });
  };

  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}


