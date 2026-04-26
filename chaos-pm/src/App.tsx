import { lazy, Suspense, useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import { getCurrentSession, hydrateSession, onAuthChange, logout, type AuthSession } from './auth';
import { analyticsIdentify, analyticsReset, track } from './analytics';
import { SUPABASE_CONFIGURED } from './supabase';

// Lazy-load the entire authenticated app — Liveblocks, Canvas, all
// widget components — so the AuthScreen has a tiny critical path.
const AuthedApp = lazy(() => import('./AuthedApp'));

// Sentry user binding is fire-and-forget; resolves after the lazy
// Sentry SDK init in main.tsx completes.
const setSentryUserLazy = (user: { id: string; email: string } | null): void => {
  void import('./sentry').then((m) => m.setSentryUser(user)).catch(() => { /* ignore */ });
};

const Loader = ({ label }: { label: string }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', color: 'var(--text-muted, #94a3b8)',
  }}>{label}</div>
);

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(!SUPABASE_CONFIGURED);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setSession(getCurrentSession());
      setAuthReady(true);
      return;
    }
    let mounted = true;
    hydrateSession().then((s) => {
      if (!mounted) return;
      setSession(s);
      setSentryUserLazy(s ? { id: s.userId, email: s.email } : null);
      setAuthReady(true);
    });
    const unsub = onAuthChange((s) => {
      if (!mounted) return;
      setSession(s);
      setSentryUserLazy(s ? { id: s.userId, email: s.email } : null);
    });
    return () => { mounted = false; unsub(); };
  }, []);

  const handleAuth = () => { /* state updates via onAuthChange */ };
  const handleLogout = async () => {
    track('Toolbar_Logout_Click');
    analyticsReset();
    await logout();
    window.location.reload();
  };

  if (!authReady) return <Loader label="loading..." />;
  if (!session) return <AuthScreen onAuth={handleAuth} />;

  // session exists → identify and render the lazy authed app
  analyticsIdentify(session.email, { name: session.name });

  return (
    <Suspense fallback={<Loader label="opening canvas..." />}>
      <AuthedApp session={session} onLogout={handleLogout} />
    </Suspense>
  );
}
