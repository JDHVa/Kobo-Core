import React from 'react';

// Evita que un error en un componente tumbe toda la app en blanco
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary:', error, info); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-steel-200 bg-white p-7 text-center shadow-lift">
          <p className="text-4xl">🔧</p>
          <h2 className="mt-3 font-display text-xl font-bold text-ink">Algo se rompió</h2>
          <p className="mt-2 text-sm text-ink-mute">Ocurrió un error inesperado. Tus datos están a salvo (LocalStorage + Supabase).</p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-xl bg-steel-50 p-3 text-left text-[11px] text-clay-600">{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-steel-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-steel-900">
            Recargar la app
          </button>
        </div>
      </div>
    );
  }
}
