import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { ValidationError } from '../../core/errors.js';
import { getClientesRadar } from './clientes.radar.service.js';

function parseFilter(value) {
  return String(value || '').trim() || undefined;
}

export async function getClientesRadarHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  const filters = {
    vendedor_id: parseFilter(query.vendedor_id),
    cidade: parseFilter(query.cidade),
    estado: parseFilter(query.estado),
    segmento: parseFilter(query.segmento)
  };
  if (String(query.segmento || '').trim() === ' ') throw new ValidationError('Filtro segmento invalido', { code: 'VALIDATION_ERROR', domain: 'clientes-crm' });
  return { ok: true, ...await getClientesRadar({ accountId, filters }) };
}
