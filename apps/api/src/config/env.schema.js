export const envSchema = {
  NODE_ENV: {
    required: true,
    defaultValue: 'development',
    allowed: ['development', 'test', 'production']
  },
  API_PORT: {
    required: true,
    defaultValue: '3000',
    type: 'number'
  },
  SUPABASE_URL: {
    required: false,
    defaultValue: ''
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: false,
    defaultValue: ''
  },
  SUPABASE_ANON_KEY: {
    required: false,
    defaultValue: ''
  }
};
