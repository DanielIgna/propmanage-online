// Catches any uncaught render error and shows a recoverable message
// instead of a blank/black screen.
import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Always log so DevTools console shows it
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-100 px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-2xl font-serif">Ceva nu a mers cum trebuie</h1>
          <p className="text-stone-400 text-sm">
            Aplicația a întâmpinat o eroare neașteptată. Probabil un cache vechi din browser.
          </p>
          <div className="bg-black/40 border border-white/10 rounded-lg p-3 text-left text-[11px] font-mono text-rose-300 max-h-32 overflow-auto">
            {String(this.state.error?.message || this.state.error || "Unknown error")}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={this.handleReload}
              className="flex-1 px-4 py-2 rounded-lg bg-[#d4ff3a] text-stone-950 text-sm font-semibold hover:opacity-90"
              data-testid="errorboundary-reload"
            >
              Reîncarcă pagina
            </button>
            <button
              onClick={this.handleHome}
              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-stone-300 text-sm hover:bg-white/10"
              data-testid="errorboundary-home"
            >
              Înapoi acasă
            </button>
          </div>
          <p className="text-[11px] text-stone-500">
            Dacă problema persistă, șterge cookies pentru propmanage.ro și încearcă din nou.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
