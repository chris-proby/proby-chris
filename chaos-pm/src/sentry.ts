import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN ?? '';
const ENV = import.meta.env.MODE; // 'development' | 'production'

export const SENTRY_ENABLED = !!DSN;

export function initSentry(): void {
  if (!SENTRY_ENABLED) return;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: import.meta.env.VITE_GIT_SHA ?? undefined,

    // Performance monitoring (10% sample in prod, 100% in dev)
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,

    // Session replay only on errors (privacy + cost control)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Drop noisy errors that we can't act on
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection captured',
      'cancelled',
      'AbortError',
      // browser extensions inject these
      'top.GLOBALS',
      /^Script error\.?$/,
    ],

    // Strip query strings from URLs in breadcrumbs (avoid leaking tokens)
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data?.url && typeof breadcrumb.data.url === 'string') {
        try {
          const u = new URL(breadcrumb.data.url, window.location.origin);
          u.search = '';
          breadcrumb.data.url = u.toString();
        } catch { /* ignore */ }
      }
      return breadcrumb;
    },
  });
}

export function setSentryUser(user: { id: string; email: string } | null): void {
  if (!SENTRY_ENABLED) return;
  if (!user) Sentry.setUser(null);
  else Sentry.setUser({ id: user.id, email: user.email });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
