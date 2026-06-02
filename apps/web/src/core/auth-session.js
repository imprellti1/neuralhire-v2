const SESSION_KEY = 'neuralhire.supabase.session';

export function getAuthSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session || null));
  if (session?.access_token) window.localStorage.setItem('neuralhire.supabase.access_token', session.access_token);
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem('neuralhire.supabase.access_token');
}

export function hasAuthSession() {
  return Boolean(getAuthSession()?.access_token);
}
