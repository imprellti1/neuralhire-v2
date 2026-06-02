export const envSchema = {
  NODE_ENV: { required: true, defaultValue: 'development', allowed: ['development', 'test', 'production'] },
  APP_ENV: { required: false, defaultValue: 'development', allowed: ['development', 'test', 'homologation', 'production'] },
  AUTH_MODE: { required: false, defaultValue: 'legacy', allowed: ['legacy', 'supabase'] },
  API_PORT: { required: true, defaultValue: '3000', type: 'number' },
  SUPABASE_URL: { required: false, defaultValue: '' },
  SUPABASE_SERVICE_ROLE_KEY: { required: false, defaultValue: '' },
  SUPABASE_ANON_KEY: { required: false, defaultValue: '' },
  ASAAS_ENV: { required: false, defaultValue: 'sandbox', allowed: ['sandbox', 'production'] },
  ASAAS_API_KEY: { required: false, defaultValue: '' },
  ASAAS_ALLOW_PRODUCTION: { required: false, defaultValue: 'false', allowed: ['true', 'false'] }
};
