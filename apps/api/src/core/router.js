import { NotFoundError } from './errors.js';
import { parseJsonBody } from './body-parser.js';
import { validatePayload } from './validator.js';
import { runMiddlewares } from './middleware-runner.js';
import { enforceRoutePermission } from './rbac.middleware.js';
import { parsePathname } from './query-params.js';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

function normalizePath(url) {
  return parsePathname(url);
}

function matchPath(routePath, requestPath) {
  if (routePath === requestPath) return { matched: true, params: {} };

  const routeParts = String(routePath).split('/').filter(Boolean);
  const requestParts = String(requestPath).split('/').filter(Boolean);
  if (routeParts.length !== requestParts.length) return { matched: false, params: {} };

  const params = {};
  for (let i = 0; i < routeParts.length; i += 1) {
    const routePart = routeParts[i];
    const requestPart = requestParts[i];

    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = requestPart;
      continue;
    }

    if (routePart !== requestPart) return { matched: false, params: {} };
  }

  return { matched: true, params };
}

export function createRouter() {
  const routes = [];

  function registerRoute({ method, path, handler, domain = 'core-platform', middlewares = [], schema = null }) {
    routes.push({ method: method.toUpperCase(), path, handler, domain, middlewares, schema });
  }

  return {
    registerRoute,
    get(path, handler) {
      registerRoute({ method: 'GET', path, handler });
    },
    post(path, handler) {
      registerRoute({ method: 'POST', path, handler });
    },
    async resolve(req, res, context) {
      const method = (req.method || 'GET').toUpperCase();
      const path = normalizePath(req.url);
      let selected = null;

      for (const candidate of routes) {
        if (candidate.method !== method) continue;
        const matched = matchPath(candidate.path, path);
        if (matched.matched) {
          selected = { route: candidate, params: matched.params };
          break;
        }
      }

      if (!selected) {
        throw new NotFoundError('Rota nao encontrada', {
          details: { method, path }
        });
      }

      const { route, params } = selected;
      context.route = { method: route.method, path: route.path, domain: route.domain };
      context.params = params;

      await enforceRoutePermission(method, route.path, req, res, context);

      const shouldContinue = await runMiddlewares(route.middlewares, req, res, context);
      if (shouldContinue === false) return;

      if (METHODS_WITH_BODY.has(method)) {
        const parsedBody = await parseJsonBody(req);
        if (route.schema) {
          context.body = validatePayload(parsedBody || {}, route.schema, { domain: route.domain });
        } else {
          context.body = parsedBody;
        }
      }

      await route.handler(req, res, context);
    }
  };
}