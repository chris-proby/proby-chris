import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const SUPABASE_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_CONFIGURED) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
    );
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'chaospm-supabase-auth',
    },
  });
  return _client;
}

// Convenience: returns the current access token (for API requests).
// If the cached session is expired, attempt one explicit refresh before giving up.
export async function getAccessToken(): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const sess = data.session;
  if (sess?.access_token) {
    const expSec = sess.expires_at ?? 0;
    // Refresh if token expires within 60 seconds
    if (expSec * 1000 - Date.now() < 60_000) {
      const { data: refreshed } = await sb.auth.refreshSession();
      return refreshed.session?.access_token ?? null;
    }
    return sess.access_token;
  }
  return null;
}

// Wrap fetch with bearer auth + 401 handling. On 401, drops the local
// session and surfaces a clear error so the UI can redirect to login.
export async function authedFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && SUPABASE_CONFIGURED) {
    // Session is dead — clear it so onAuthChange surfaces login screen.
    await getSupabase().auth.signOut().catch(() => {});
  }
  return res;
}
