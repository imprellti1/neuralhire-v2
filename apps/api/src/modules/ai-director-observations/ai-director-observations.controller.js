import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { createObservation, getObservationById, getOpenObservationsForDirector, listObservations, updateObservationStatus } from './ai-director-observations.repository.js';

export async function listAiDirectorObservationsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await listObservations({ accountId }, context?.query || {})) };
}

export async function getAiDirectorObservationHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const item = await getObservationById({ accountId }, context?.params?.id);
  return { ok: true, item };
}

export async function createAiDirectorObservationHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const item = await createObservation({ accountId }, context?.body || {});
  return { ok: true, item };
}

export async function patchAiDirectorObservationHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const item = await updateObservationStatus({ accountId }, context?.params?.id, context?.body || {});
  return { ok: true, item };
}

export async function listOpenAiDirectorObservationsForDirectorHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await getOpenObservationsForDirector({ accountId }, { limit: context?.query?.limit || 10 })) };
}
