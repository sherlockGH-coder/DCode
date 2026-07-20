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
            <h1>界面暂时无法显示</h1>
            <p>应用状态没有被删除。重新载入后仍可继续；如果问题重复出现，请保留日志用于诊断。</p>
            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <pre>{this.state.error.message}</pre>
            )}
          </div>
          <button type="button" onClick={() => window.location.reload()}>重新载入</button>
        </section>
      </main>
    );
  }
}
