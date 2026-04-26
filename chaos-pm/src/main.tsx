import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { runMigrations } from './migrate';
import { ErrorBoundary } from './ErrorBoundary';

// Defer Sentry SDK loading until the browser is idle.
// Cuts ~50KB off the critical-path bundle. Errors that happen before
// idle still fire window.onerror, which Sentry will catch when it
// initializes (it adds the listener on init).
function deferSentryInit() {
  const idle = (cb: () => void) =>
    'requestIdleCallback' in window
      ? (window as Window & typeof globalThis).requestIdleCallback(cb, { timeout: 3000 })
      : setTimeout(cb, 1500);
  idle(() => { void import('./sentry').then((m) => m.initSentry()); });
}
deferSentryInit();

function FallbackError(error: unknown, reset: () => void) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', padding: 32, gap: 12, fontFamily: '-apple-system, sans-serif',
    }}>
      <div style={{ fontSize: 28 }}>💥</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>예기치 못한 오류가 발생했습니다</div>
      <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 480, textAlign: 'center' }}>
        {error instanceof Error ? error.message : '알 수 없는 오류'}
      </div>
      <button
        onClick={() => { reset(); window.location.reload(); }}
        style={{
          marginTop: 12, padding: '8px 18px', borderRadius: 6,
          border: '1px solid #6366f1', background: '#6366f1', color: '#fff',
          fontSize: 13, cursor: 'pointer',
        }}
      >
        새로고침
      </button>
    </div>
  );
}

function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary fallback={FallbackError}>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

// Run migrations before rendering so Zustand hydrates with correct data
runMigrations().then(mount).catch(mount);
