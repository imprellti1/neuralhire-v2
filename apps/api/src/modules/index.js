import { defineModule } from '../core/module-contract.js';
import { registerHealthRoutes } from './health/health.routes.js';
import { registerSystemRoutes } from './system/system.routes.js';
import { registerClientesRoutes } from './clientes/clientes.routes.js';
import { clientesModule } from './clientes/clientes.module.js';
import { registerProdutosRoutes } from './produtos/produtos.routes.js';
import { produtosModule } from './produtos/produtos.module.js';
import { registerPedidosRoutes } from './pedidos/pedidos.routes.js';
import { pedidosModule } from './pedidos/pedidos.module.js';
import { registerAnalyticsRoutes } from './analytics/analytics.routes.js';
import { analyticsModule } from './analytics/analytics.module.js';

export const registeredModules = [
  defineModule({
    name: 'health',
    domain: 'core-platform',
    routes: ['GET /health']
  }),
  defineModule({
    name: 'system',
    domain: 'core-platform',
    routes: [
      'GET /system/info',
      'GET /system/auth-context',
      'GET /system/protected',
      'GET /system/admin-only',
      'POST /system/echo'
    ]
  }),
  clientesModule,
  produtosModule,
  pedidosModule,
  analyticsModule
];

export function registerModules(router, options = {}) {
  registerHealthRoutes(router);
  registerSystemRoutes(router, {
    registeredModules,
    globalMiddlewares: options.globalMiddlewares || []
  });
  registerClientesRoutes(router);
  registerProdutosRoutes(router);
  registerPedidosRoutes(router);
  registerAnalyticsRoutes(router);
}
