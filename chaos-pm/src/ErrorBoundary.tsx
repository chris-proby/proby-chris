import React from 'react';

// Minimal local ErrorBoundary — independent of Sentry so the SDK
// can be lazy-loaded without delaying the safety net.
// When Sentry is initialized later, its global window.onerror /
// onunhandledrejection handlers still capture errors thrown from
// React render via reportError().

interface Props {
  fallback: (error: unknown, reset: () => void) => React.ReactNode;
  children: React.ReactNode;
}

interface State { error: unknown | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Surface to global handlers (Sentry etc.) without a hard dep
    if (error instanceof Error) {
      try {
        window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error !== null) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
