import { acquireSystemJobLock, releaseSystemJobLock } from './jobs.repository.js';

export async function withSystemJobLock(jobConfig, fn) {
  const acquired = await acquireSystemJobLock(jobConfig);
  if (!acquired.acquired) return { acquired: false, job: acquired.job, result: null };
  try {
    const result = await fn(acquired.job);
    return { acquired: true, job: result?.job || acquired.job, result };
  } finally {
    await releaseSystemJobLock(jobConfig.lockKey, { locked_at: null, locked_by: null }).catch(() => null);
  }
}
