export async function createSupabaseClient(url, anonKey) {
  if (!url || !anonKey) {
    return null;
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.__NEURALHIRE_SUPABASE_CREATE_CLIENT__ === 'function'
  ) {
    return window.__NEURALHIRE_SUPABASE_CREATE_CLIENT__(url, anonKey);
  }

  if (typeof window !== 'undefined') {
    const module = await import('https://esm.sh/@supabase/supabase-js@2');
    return module.createClient(url, anonKey);
  }

  return null;
}
