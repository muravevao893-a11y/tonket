import React from 'react';

type ErrorBoundaryState = {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown frontend error';
  }
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('[TONKET frontend crash]', error, errorInfo);
  }

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="min-h-[100dvh] bg-[#0f0f13] px-4 py-8 text-slate-100">
        <section className="mx-auto max-w-md rounded-3xl border border-red-500/20 bg-red-500/10 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.32)]">
          <div className="text-4xl">🧯</div>
          <h1 className="mt-4 text-2xl font-black text-white">Frontend crashed</h1>
          <p className="mt-2 text-sm leading-6 text-red-100/80">
            React упал до рендера экрана, поэтому раньше ты видел просто серый экран. Теперь ошибка видна прямо в Mini App.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">Error</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs font-semibold text-red-50">{getErrorMessage(error)}</pre>
          </div>
          {errorInfo?.componentStack && (
            <details className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer text-xs font-black text-slate-200">Component stack</summary>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-[11px] text-slate-400">{errorInfo.componentStack}</pre>
            </details>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-all duration-300 hover:bg-blue-500 active:scale-95"
          >
            Reload app
          </button>
        </section>
      </main>
    );
  }
}
