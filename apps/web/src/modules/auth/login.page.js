import { clearAuthSession, saveAuthSession } from '../../core/auth-session.js';
import { createSupabaseClient } from '../../core/supabase-client.js';

function getSupabaseConfig() {
  const runtime = typeof window !== 'undefined' ? window.__NEURALHIRE_CONFIG__ || {} : {};
  const env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
  return {
    url: runtime.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL,
    anonKey: runtime.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  };
}

async function createSupabaseAuthClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  const client = await createSupabaseClient(url, anonKey);
  if (!client) return null;
  return client;
}

export async function renderLoginPage(container, { onLogin = null } = {}) {
  clearAuthSession();
  container.innerHTML = `
    <section style="max-width:480px;margin:64px auto;padding:32px;border-radius:24px;background:#fff;box-shadow:0 18px 44px rgba(15,35,74,.12)">
      <h1 style="margin:0 0 8px;font-size:32px;color:#10203b">Entrar no NeuralHire</h1>
      <p style="margin:0 0 24px;color:#5f6f8d">Acesse sua conta para entrar na área administrativa.</p>
      <form id="nh-login-form" style="display:grid;gap:14px">
        <label>Email<input name="email" type="email" required style="width:100%;padding:12px;border:1px solid #cfd9ea;border-radius:12px"></label>
        <label>Senha<input name="password" type="password" required style="width:100%;padding:12px;border:1px solid #cfd9ea;border-radius:12px"></label>
        <button type="submit" style="padding:12px 16px;border:0;border-radius:12px;background:#1d4ed8;color:#fff;font-weight:700">Entrar</button>
        <div id="nh-login-status" style="min-height:20px;color:#b42318"></div>
      </form>
    </section>`;

  const form = container.querySelector('#nh-login-form');
  const status = container.querySelector('#nh-login-status');
  const authMessage = 'Configuração de autenticação indisponível.';
  const supabase = await createSupabaseAuthClient();
  if (!supabase) {
    status.textContent = authMessage;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) {
      status.textContent = authMessage;
      return;
    }
    const formData = new FormData(form);
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      status.textContent = error?.message || 'Falha no login.';
      return;
    }
    saveAuthSession(data.session);
    if (typeof onLogin === 'function') onLogin(data.session);
    window.location.hash = '#/dashboard-comercial';
  });
}
