import { envSchema } from './env.schema.js';
import { ValidationError } from '../core/errors.js';

export function validateEnv(source = process.env) {
  const parsed = {};

  for (const [key, rule] of Object.entries(envSchema)) {
    const rawValue = source[key];
    const withDefault = rawValue === undefined || rawValue === null || rawValue === ''
      ? rule.defaultValue
      : rawValue;

    if (rule.required && (withDefault === undefined || withDefault === null || withDefault === '')) {
      throw new ValidationError(`Variavel obrigatoria ausente: ${key}`, {
        details: { key }
      });
    }

    let value = withDefault;

    if (rule.type === 'number') {
      value = Number(withDefault);
      if (Number.isNaN(value)) {
        throw new ValidationError(`Variavel ${key} deve ser numero`, {
          details: { key, received: withDefault }
        });
      }
    }

    if (rule.allowed && !rule.allowed.includes(value)) {
      throw new ValidationError(`Variavel ${key} invalida`, {
        details: { key, received: value, allowed: rule.allowed }
      });
    }

    parsed[key] = value;
  }

  return parsed;
}

export const env = validateEnv();

export function getEnvSummary() {
  return {
    nodeEnv: env.NODE_ENV,
    apiPort: env.API_PORT,
    supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    hasServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    hasAnonKey: Boolean(env.SUPABASE_ANON_KEY)
  };
}
