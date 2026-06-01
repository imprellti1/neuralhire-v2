import { UnauthorizedError } from './errors.js';

export function requireAuth() {
  return async (req, res, context) => {
    if (context?.auth?.authenticated !== true) {
      throw new UnauthorizedError('Autenticacao obrigatoria', {
        code: 'AUTH_REQUIRED',
        domain: 'autenticacao-contas',
        details: {
          tokenPresent: Boolean(context?.auth?.tokenPresent),
          authError: context?.auth?.authError || null
        }
      });
    }
    return true;
  };
}
