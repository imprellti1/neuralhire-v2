import { env } from '../../config/env.js';
import { getSupabaseStatus } from '../../database/supabase.client.js';

const startTime = Date.now();

export function getHealthStatus() {
  return {
    ok: true,
    service: 'neuralhire-api-v2',
    version: '0.1.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    dependencies: {
      supabase: getSupabaseStatus()
    }
  };
}
