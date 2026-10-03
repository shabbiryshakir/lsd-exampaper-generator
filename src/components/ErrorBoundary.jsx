import { Component } from 'react'

// If anything inside a paper fails to show, the teacher sees a clear message and a way
// back instead of a frozen screen, and the app stops reopening that paper on start-up.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('Paper failed to show:', error, info?.componentStack);
    try { localStorage.removeItem('session'); } catch { /* storage blocked */ }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-md mx-auto mt-10 bg-white rounded-3xl border border-slate-200 p-6 text-center">
        <div className="text-lg font-bold text-slate-900 mb-2">This paper could not be shown</div>
        <p className="text-slate-600 mb-5">Your saved work is safe. Please go back and try again. If it keeps happening, tell us the paper's name so we can fix it.</p>
        <button onClick={() => { this.setState({ error: null }); this.props.onBack?.(); }} className="w-full bg-brand-700 text-white font-bold py-3 rounded-2xl">Back to my papers</button>
        <p className="text-xs text-slate-400 mt-4 break-words">{String(this.state.error?.message || this.state.error)}</p>
      </div>
    );
  }
}
