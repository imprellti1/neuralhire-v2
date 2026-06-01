import { createServer } from 'node:http';
import { createApiApp } from './app.js';
import { env, getEnvSummary } from './config/env.js';
import { logger } from './core/logger.js';
import { loadDemoMemoryFromDisk } from './testing/demo-memory.store.js';

const app = createApiApp();
const server = createServer(app);

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', {
    message: error?.message,
    stack: error?.stack
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    reason: String(reason)
  });
});

async function bootstrap() {
  const demo = await loadDemoMemoryFromDisk();
  if (demo.loaded) {
    logger.info('demo_memory_loaded', { mode: 'memory', source: 'disk' });
  }

  server.listen(env.API_PORT, () => {
    logger.info('api_server_started', {
      port: env.API_PORT,
      env: getEnvSummary()
    });
    console.log(`NeuralHire API v2 listening on port ${env.API_PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error('api_bootstrap_failed', {
    message: error?.message,
    stack: error?.stack
  });
  process.exit(1);
});
