import { assertTenantContext } from './tenant-context.js';

export function requireTenant({ domain = 'core-platform' } = {}) {
  return async (req, res, context) => {
    assertTenantContext(context, { domain });
    return true;
  };
}