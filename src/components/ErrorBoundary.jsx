import { Component } from 'react'

// Stops one bad paper (or a rendering bug) from blanking the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Render error:', error, info) }
  componentDidUpdate(prev) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-xl p-6 text-center print:hidden">
        <h2 className="font-bold text-red-700 mb-2">Something went wrong showing this page</h2>
        <p className="text-sm text-red-600 mb-4">Your work is safe — a draft is kept in this browser. Try again, or go back to the editor.</p>
        <pre className="text-xs text-left bg-white border rounded p-2 overflow-auto max-h-32 mb-4">{String(this.state.error?.message || this.state.error)}</pre>
        <div className="flex gap-2 justify-center">
          <button onClick={() => this.setState({ error: null })} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-bold">Try again</button>
          {this.props.onBack && <button onClick={this.props.onBack} className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-bold">Back to editor</button>}
        </div>
      </div>
    )
  }
}
