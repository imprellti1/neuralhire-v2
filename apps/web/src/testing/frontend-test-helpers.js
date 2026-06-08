import { JSDOM } from 'jsdom';

export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function setupFrontendDom(hash = '#/', hostname = 'localhost') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: `http://${hostname}/${hash}` });
  const previousBlob = global.Blob;
  const previousFile = global.File;
  const previousFormData = global.FormData;
  global.window = dom.window;
  global.document = dom.window.document;
  window.__NEURALHIRE_CONFIG__ = {
    VITE_APP_ENV: 'development',
    VITE_SUPABASE_URL: 'https://qvwbsadesksrhcslmmjg.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_API_URL: 'https://api.neuralhire.com.br'
  };
  window.__NEURALHIRE_SUPABASE_CREATE_CLIENT__ = () => ({
    auth: {
      signInWithPassword: async () => ({ data: { session: { access_token: 'test-token' } }, error: null }),
      getUser: async () => ({ data: { user: { id: 'test-user', email: 'test@neuralhire.com.br' } }, error: null })
    }
  });
  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true
  });
  global.Blob = dom.window.Blob;
  global.File = dom.window.File;
  global.FormData = dom.window.FormData;
  global.URL = dom.window.URL;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
  window.cancelAnimationFrame = clearTimeout;
  dom.__previousGlobals = { previousBlob, previousFile, previousFormData };
  return dom;
}

export function mockAuthenticatedSession(session = {}) {
  const authSession = {
    access_token: session.access_token || 'test-token',
    refresh_token: session.refresh_token || 'test-refresh-token',
    token_type: session.token_type || 'bearer',
    user: session.user || { id: 'test-user', email: 'test@neuralhire.com.br' },
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + 3600,
    ...session
  };
  window.localStorage.setItem('neuralhire.supabase.session', JSON.stringify(authSession));
  window.localStorage.setItem('neuralhire.supabase.access_token', authSession.access_token);
  window.__NEURALHIRE_SUPABASE_CREATE_CLIENT__ = () => ({
    auth: {
      signInWithPassword: async () => ({ data: { session: authSession }, error: null }),
      getUser: async () => ({ data: { user: authSession.user }, error: null })
    }
  });
  return authSession;
}

export function teardownFrontendDom(dom) {
  const win = typeof global.window !== 'undefined' ? global.window : null;
  if (win) {
    delete win.__NEURALHIRE_SUPABASE_CREATE_CLIENT__;
    delete win.requestAnimationFrame;
    delete win.cancelAnimationFrame;
  }
  dom.window.close();
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.Blob;
  delete global.File;
  delete global.FormData;
  delete global.URL;
  delete global.Event;
  delete global.KeyboardEvent;
  delete global.fetch;

  const previousGlobals = dom.__previousGlobals || {};
  if (typeof previousGlobals.previousBlob !== 'undefined') global.Blob = previousGlobals.previousBlob;
  if (typeof previousGlobals.previousFile !== 'undefined') global.File = previousGlobals.previousFile;
  if (typeof previousGlobals.previousFormData !== 'undefined') global.FormData = previousGlobals.previousFormData;
  delete dom.__previousGlobals;
}

export function setHash(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
}

export function mockObjectUrl() {
  let count = 0;
  URL.createObjectURL = () => `blob:mock-${++count}`;
  URL.revokeObjectURL = () => {};
}

export function mockAnchorClicks(dom) {
  const clicks = [];
  const original = dom.window.HTMLAnchorElement.prototype.click;
  dom.window.HTMLAnchorElement.prototype.click = function click() {
    clicks.push(this.download || this.href || '');
  };
  return {
    clicks,
    restore() {
      dom.window.HTMLAnchorElement.prototype.click = original;
    }
  };
}

export function findButtonByText(text) {
  return Array.from(document.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === text) || null;
}

export function dispatchInput(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function dispatchChange(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function dispatchKeydown(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}
