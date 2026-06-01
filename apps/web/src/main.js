import { bootstrapWebApp } from './app.js';

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const mountNode = document.getElementById('root');
  if (!mountNode) {
    throw new Error('Root element #root not found');
  }
  bootstrapWebApp();
}
