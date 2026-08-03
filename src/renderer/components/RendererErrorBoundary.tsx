import React from 'react';

interface RendererErrorBoundaryState {
  error: Error | null;
}

export default class RendererErrorBoundary extends React.Component<React.PropsWithChildren, RendererErrorBoundaryState> {
  state: RendererErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RendererErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[renderer] uncaught render error', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="renderer-error-stage">
        <section className="renderer-error-card" role="alert">
          <span className="renderer-error-icon" aria-hidden>!</span>
          <div>
            <h1>The interface is temporarily unavailable</h1>
            <p>Your application state was not deleted. Reload to continue; if the problem persists, keep the logs for diagnosis.</p>
            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <pre>{this.state.error.message}</pre>
            )}
          </div>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </section>
      </main>
    );
  }
}
