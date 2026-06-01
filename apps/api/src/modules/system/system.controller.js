import { getEnvSummary } from '../../config/env.js';
import { createAuditEvent } from '../../core/audit.js';

function sanitizeAuth(auth = {}) {
  return {
    authenticated: Boolean(auth.authenticated),
    tokenPresent: Boolean(auth.tokenPresent),
    userId: auth.userId || null,
    email: auth.email || null,
    role: auth.role || null,
    accountId: auth.accountId || null,
    source: auth.source || 'anonymous',
    authError: auth.authError || null
  };
}

export function getSystemInfo(registeredModules = [], globalMiddlewares = []) {
  return {
    ok: true,
    service: 'neuralhire-api-v2',
    version: '0.1.0',
    env: getEnvSummary(),
    modules: registeredModules.map((moduleDef) => moduleDef.name),
    totalModules: registeredModules.length,
    globalMiddlewares,
    architecture: {
      runtime: 'node-http-native',
      style: 'modular-monorepo',
      legacyMode: 'read-only'
    }
  };
}

export function echoSystemMessage(context) {
  return {
    ok: true,
    echo: context.body.message,
    requestId: context.requestId,
    auth: sanitizeAuth(context.auth),
    auditPreview: createAuditEvent({
      context,
      domain: 'core-platform',
      action: 'system.echo'
    })
  };
}

export function getAuthContext(context) {
  return {
    ok: true,
    auth: sanitizeAuth(context.auth),
    requestId: context.requestId
  };
}

export function getProtectedSystem(context) {
  return {
    ok: true,
    message: 'authenticated access granted',
    auth: sanitizeAuth(context.auth),
    requestId: context.requestId
  };
}

export function getAdminOnlySystem(context) {
  return {
    ok: true,
    message: 'admin access granted',
    auth: sanitizeAuth(context.auth),
    requestId: context.requestId
  };
}
