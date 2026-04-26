import { getSupabase, SUPABASE_CONFIGURED } from './supabase';

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  expiresAt: number;
}

// In-memory cache so synchronous getCurrentSession() works for legacy callers.
// Updated by hydrateSession() and the supabase auth state listener.
let _cached: AuthSession | null = null;

export function getCurrentSession(): AuthSession | null {
  if (!_cached) return null;
  if (Date.now() > _cached.expiresAt) { _cached = null; return null; }
  return _cached;
}

function sessionFrom(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null,
                    expiresAt: number | null): AuthSession | null {
  if (!user || !user.email) return null;
  const meta = user.user_metadata ?? {};
  const name = (meta.name as string | undefined) ?? user.email.split('@')[0];
  return {
    userId: user.id,
    email: user.email,
    name,
    expiresAt: (expiresAt ?? Math.floor(Date.now() / 1000) + 3600) * 1000,
  };
}

// Initial async hydration — call once at app boot before reading getCurrentSession().
export async function hydrateSession(): Promise<AuthSession | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await getSupabase().auth.getSession();
  _cached = sessionFrom(data.session?.user ?? null, data.session?.expires_at ?? null);
  return _cached;
}

// Subscribe to auth changes (login/logout/token refresh)
export function onAuthChange(cb: (s: AuthSession | null) => void): () => void {
  if (!SUPABASE_CONFIGURED) return () => {};
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    _cached = sessionFrom(session?.user ?? null, session?.expires_at ?? null);
    cb(_cached);
  });
  return () => data.subscription.unsubscribe();
}

export async function login(email: string, password: string): Promise<AuthSession> {
  if (!SUPABASE_CONFIGURED) throw new Error('인증 서비스가 설정되지 않았습니다');
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(translateAuthError(error.message));
  const s = sessionFrom(data.user, data.session?.expires_at ?? null);
  if (!s) throw new Error('로그인 응답이 올바르지 않습니다');
  _cached = s;
  return s;
}

export async function register(email: string, password: string, name: string): Promise<AuthSession> {
  if (!SUPABASE_CONFIGURED) throw new Error('인증 서비스가 설정되지 않았습니다');
  if (password.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다');
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim() || email.split('@')[0] } },
  });
  if (error) throw new Error(translateAuthError(error.message));
  // If email confirmation is required, session may be null
  const s = sessionFrom(data.user, data.session?.expires_at ?? null);
  if (!s) {
    throw new Error('가입 완료. 이메일을 확인하여 인증을 완료해주세요.');
  }
  _cached = s;
  return s;
}

export async function logout(): Promise<void> {
  if (!SUPABASE_CONFIGURED) { _cached = null; return; }
  await getSupabase().auth.signOut();
  _cached = null;
}

export async function signInWithGoogle(): Promise<void> {
  if (!SUPABASE_CONFIGURED) throw new Error('인증 서비스가 설정되지 않았습니다');
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw new Error(translateAuthError(error.message));
  // Redirect happens automatically; the session is restored on callback.
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!SUPABASE_CONFIGURED) throw new Error('인증 서비스가 설정되지 않았습니다');
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  if (error) throw new Error(translateAuthError(error.message));
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (m.includes('already registered') || m.includes('already in use')) return '이미 사용 중인 이메일입니다';
  if (m.includes('email not confirmed')) return '이메일 인증을 완료해주세요';
  if (m.includes('rate limit')) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요';
  return msg;
}
