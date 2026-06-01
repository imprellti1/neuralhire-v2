import { ValidationError } from './errors.js';

export function defineModule({
  name,
  domain,
  version = '0.1.0',
  routes = [],
  dependencies = []
}) {
  const details = [];
  if (!name) details.push({ field: 'name', message: 'Nome do modulo obrigatorio', rule: 'required' });
  if (!domain) details.push({ field: 'domain', message: 'Dominio do modulo obrigatorio', rule: 'required' });
  if (!Array.isArray(routes)) details.push({ field: 'routes', message: 'Routes deve ser array', rule: 'type' });
  if (!Array.isArray(dependencies)) details.push({ field: 'dependencies', message: 'Dependencies deve ser array', rule: 'type' });

  if (details.length) {
    throw new ValidationError('Contrato de modulo invalido', { details, domain: 'core-platform' });
  }

  return Object.freeze({ name, domain, version, routes, dependencies });
}
